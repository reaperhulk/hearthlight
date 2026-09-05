import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";

function worker({ offline = false, manifestOk = true } = {}) {
  const listeners = {},
    stored = new Map(),
    deleted = [];
  const shell = {
    ok: true,
    clone() {
      return this;
    },
    kind: "shell",
  };
  const cache = {
    addAll: vi.fn(async (urls) => {
      for (const url of urls) stored.set(url, shell);
    }),
    match: vi.fn(async (key) =>
      stored.get(typeof key === "string" ? key : key.url),
    ),
    put: vi.fn(async (key, value) =>
      stored.set(typeof key === "string" ? key : key.url, value),
    ),
  };
  const self = {
    location: { href: "https://example.test/hearthlight/sw.js" },
    addEventListener: (name, fn) => (listeners[name] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const fetch = vi.fn(async (request) => {
    if (String(request).endsWith("precache.json"))
      return {
        ok: manifestOk,
        json: async () => ["index.html", "assets/game.js"],
      };
    if (offline) throw Error("offline");
    return shell;
  });
  runInNewContext(
    readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8"),
    {
      self,
      URL,
      Response,
      fetch,
      caches: {
        open: async () => cache,
        keys: async () => [
          "hearthlight-v1",
          "another-app-v1",
          "hearthlight-v2-__BUILD_STAMP__",
        ],
        delete: async (key) => deleted.push(key),
      },
    },
  );
  const emit = async (name, request) => {
    let pending;
    listeners[name]({
      request,
      waitUntil: (p) => (pending = p),
      respondWith: (p) => (pending = p),
    });
    return pending;
  };
  return { emit, cache, self, deleted, stored, fetch };
}
describe("offline lifecycle", () => {
  it("preloads the complete new shell before activation and preserves other apps", async () => {
    const w = worker();
    await w.emit("install");
    expect(w.cache.addAll).toHaveBeenCalledWith([
      "https://example.test/hearthlight/index.html",
      "https://example.test/hearthlight/assets/game.js",
    ]);
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    await w.emit("activate");
    expect(w.deleted).toEqual(["hearthlight-v1"]);
  });
  it("keeps the previous worker if the new build cannot be cached", async () => {
    const w = worker({ manifestOk: false });
    await expect(w.emit("install")).rejects.toThrow();
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
  });
  it("opens the precached page offline without a previous navigation cache", async () => {
    const w = worker({ offline: true });
    await w.emit("install");
    const response = await w.emit("fetch", {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/hearthlight/",
    });
    expect(response.kind).toBe("shell");
  });
  it("does not intercept another app on the same domain", async () => {
    const w = worker();
    expect(
      await w.emit("fetch", {
        method: "GET",
        url: "https://example.test/another-app/",
      }),
    ).toBeUndefined();
    expect(w.fetch).not.toHaveBeenCalled();
  });
});

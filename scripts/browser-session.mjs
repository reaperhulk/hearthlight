import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

// CLI/CI harness. Requires a real Chromium installation via CHROME_PATH.
export async function browserSession({ uncapped = false } = {}) {
  const executablePath = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].find((p) => p && existsSync(p));
  if (!executablePath)
    throw new Error("Set CHROME_PATH to an installed Chromium executable.");
  const port = Number(process.env.HEARTHLIGHT_TEST_PORT || 4174);
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "",
    browser;
  server.stderr.on("data", (data) => {
    log += data;
  });
  server.stdout.on("data", (data) => {
    log += data;
  });
  const close = async () => {
    try {
      if (browser) await browser.close();
    } finally {
      server.kill();
    }
  };
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (server.exitCode !== null) throw new Error(`Preview stopped: ${log}`);
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* Wait for our process. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error(`Preview did not start: ${log}`);
    browser = await puppeteer.launch({
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        ...(uncapped
          ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"]
          : []),
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__game));
    return { browser, page, url, errors, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function hydrate(page, state) {
  const hook = await page.evaluateOnNewDocument(
    (saved) => localStorage.setItem("hearthlight-save", JSON.stringify(saved)),
    state,
  );
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__game));
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(hook.identifier);
  }
}

export async function clickText(page, text) {
  const handle = await page.waitForFunction(
    (value) =>
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim().startsWith(value) && !b.disabled,
      ),
    {},
    text,
  );
  await handle.asElement().click();
  await handle.dispose();
}

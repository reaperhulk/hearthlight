import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { browserSession, hydrate } from "./browser-session.mjs";
import { scene } from "./scenes.mjs";
const out = resolve(process.argv[2] || "/tmp/hearthlight-screenshots");
await mkdir(out, { recursive: true });
const session = await browserSession();
try {
  for (const width of [390, 1440]) {
    await session.page.setViewport({
      width,
      height: 900,
      deviceScaleFactor: 1,
    });
    for (const name of ["home", "first-day", "ridge-battle", "victory"]) {
      await hydrate(session.page, scene(name));
      await session.page.waitForFunction(
        () =>
          !document.querySelector(".village-map") ||
          document.querySelector(".living").width > 0,
      );
      await session.page.screenshot({
        path: resolve(out, `${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  if (session.errors.length) throw new Error(session.errors.join("\n"));
  console.log(`Screenshots saved to ${out}`);
} finally {
  await session.close();
}

// Dev tool: capture a real-render screenshot of each tab of the Flutter web
// build, for visual parity checks against the web app. Usage:
//   cd mobile && flutter build web
//   (cd mobile/build/web && python3 -m http.server 8088 &)
//   cd web && node ../mobile/tool/shoot.mjs   # run from /web — resolves @playwright/test
import { chromium } from "@playwright/test";

const tabs = [
  ["0", "home"],
  ["1", "inventory"],
  ["2", "properties"],
  ["3", "people"],
  ["4", "money"],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
});

for (const [i, name] of tabs) {
  await page.goto(`http://localhost:8088/?tab=${i}`, { waitUntil: "load" });
  // Wait for Flutter to attach its render surface, then let it paint.
  await page.waitForSelector("flt-glass-pane", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const out = `/tmp/kanzen-mobile-${i}-${name}.png`;
  await page.screenshot({ path: out });
  console.log(`shot ${name} -> ${out}`);
}

await browser.close();
console.log("done");

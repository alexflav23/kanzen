import { expect, test, type Page } from "@playwright/test";

/**
 * Browser audit (Playwright = real Chromium, same signals as DevTools):
 * walks every route + key interaction and records console errors/warnings,
 * uncaught page exceptions, failed requests and 4xx/5xx responses, with a
 * screenshot per step. Surfaces "every single thing" before we lock in tests.
 */

type Issue = { where: string; kind: string; detail: string };

const IGNORE = [/favicon\.ico/]; // dev-server noise, not an app error

function attach(page: Page, issues: Issue[], whereRef: { v: string }) {
  page.on("console", (msg) => {
    const t = msg.type();
    if (t !== "error" && t !== "warning") return;
    if (IGNORE.some((r) => r.test(msg.text()))) return;
    issues.push({ where: whereRef.v, kind: `console.${t}`, detail: msg.text() });
  });
  page.on("pageerror", (err) =>
    issues.push({ where: whereRef.v, kind: "pageerror", detail: err.message }),
  );
  page.on("requestfailed", (req) => {
    if (IGNORE.some((r) => r.test(req.url()))) return;
    issues.push({ where: whereRef.v, kind: "requestfailed", detail: `${req.url()} — ${req.failure()?.errorText}` });
  });
  page.on("response", (res) => {
    if (res.status() < 400) return;
    if (IGNORE.some((r) => r.test(res.url()))) return;
    issues.push({ where: whereRef.v, kind: `http.${res.status()}`, detail: res.url() });
  });
}

test("full UI audit: every route + interaction is clean", async ({ page }, testInfo) => {
  const issues: Issue[] = [];
  const where = { v: "boot" };
  attach(page, issues, where);

  const shot = async (name: string) => {
    where.v = name;
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  };

  // 1. Dashboard
  where.v = "dashboard";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Toby." })).toBeVisible();
  await shot("01-dashboard");

  // 2. Inventory + category filter + reset
  where.v = "inventory";
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByTestId("asset-card")).toHaveCount(4);
  await shot("02-inventory-all");
  await page.getByRole("button", { name: "Watches" }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(1);
  await shot("03-inventory-watches");
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(4);

  // 3. Finance + approve + reject
  where.v = "finance";
  await page.getByRole("link", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
  await shot("04-finance");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Reject" }).first().click();
  await shot("05-finance-after-decisions");

  // 4. Properties
  where.v = "properties";
  await page.getByRole("link", { name: "Properties" }).click();
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByTestId("property-card")).toHaveCount(2);
  await shot("06-properties");

  // 5. People
  where.v = "people";
  await page.getByRole("link", { name: "People" }).click();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await shot("07-people");

  // 6. A "Coming soon" stub route (every other nav item)
  where.v = "coming-soon";
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByText("Coming soon.")).toBeVisible();
  await shot("08-coming-soon");

  // Report everything, then fail if any hard errors were seen.
  if (issues.length) {
    console.log("\n=== UI AUDIT ISSUES ===");
    for (const i of issues) console.log(`[${i.where}] ${i.kind}: ${i.detail}`);
  } else {
    console.log("\n=== UI AUDIT: clean (no console errors, exceptions, or failed requests) ===");
  }
  const hard = issues.filter((i) => i.kind === "pageerror" || i.kind.startsWith("console.error") || i.kind.startsWith("http.5") || i.kind === "requestfailed");
  expect(hard, hard.map((i) => `[${i.where}] ${i.kind}: ${i.detail}`).join("\n")).toEqual([]);
});

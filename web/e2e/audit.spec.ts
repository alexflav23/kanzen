import { expect, test, type Page } from "@playwright/test";

/**
 * Browser audit (Playwright = real Chromium, same signals as DevTools): walks EVERY built
 * route + key interactions and records console errors/warnings, uncaught page exceptions,
 * failed requests and 4xx/5xx responses. The test fails if any hard error is seen anywhere —
 * the guarantee that no feature logs a console error against the real backend.
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
  page.on("pageerror", (err) => issues.push({ where: whereRef.v, kind: "pageerror", detail: err.message }));
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
  const nav = page.getByRole("navigation", { name: "Primary" });
  const go = async (link: string, headingRe: RegExp) => {
    where.v = link;
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: headingRe }).first()).toBeVisible();
  };

  // boot
  where.v = "dashboard";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Flavian." })).toBeVisible();

  // every nav-reachable page (each asserts its heading; the guard watches throughout)
  await go("Inbox", /^Inbox$/);
  await go("Notifications", /^Notifications$/);
  await go("Inventory", /^Inventory$/);
  await go("Insights", /^Insights$/);
  await go("Properties", /^Properties$/);
  await go("Tasks", /^Tasks$/);
  await go("Calendar", /^Calendar$/);
  await go("Lists", /^Lists$/);
  await go("Maintenance", /^Maintenance$/);
  await go("People", /^People$/);
  await go("Vendors", /^Vendors$/);
  await go("Documents", /^Documents$/);
  await go("Finance", /Bills, expenses/);
  await go("Wealth", /Net worth/);
  await go("Backup", /Backup/);

  // dynamic detail routes (reached by clicking a seeded row)
  where.v = "asset-detail";
  await nav.getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();

  where.v = "property-bible";
  await nav.getByRole("link", { name: "Properties", exact: true }).click();
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();

  // Finance tabs (each tab fetches; watch for query/render errors)
  where.v = "finance-tabs";
  await nav.getByRole("link", { name: "Finance", exact: true }).click();
  for (const tab of ["Pay queue", "Transactions", "Expenses", "Tax", "Budgets"]) {
    await page.getByRole("button", { name: tab }).click();
  }

  // ⌘K command palette (global) — open, query the live search, close
  where.v = "command-palette";
  await page.keyboard.press("Meta+k");
  if (!(await page.getByTestId("command-palette").isVisible().catch(() => false))) await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByLabel("Search").fill("guitar");
  await expect(page.getByTestId("cmdk-result").first()).toBeVisible();
  await page.keyboard.press("Escape");

  // theme toggle (dark mode) — re-render under the dark theme
  where.v = "theme-dark";
  await page.keyboard.press("Meta+d");
  if (await page.getByTestId("command-palette").isVisible().catch(() => false)) await page.keyboard.press("Escape");

  // Vehicles — the asset-registry 'vehicle' vertical (no more "Coming soon" stubs anywhere)
  where.v = "vehicles";
  await nav.getByRole("link", { name: "Vehicles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();

  // Settings — the real admin role-management page (audited like every other route)
  where.v = "settings";
  await nav.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("audit-final.png"), fullPage: true });

  if (issues.length) {
    console.log("\n=== UI AUDIT ISSUES ===");
    for (const i of issues) console.log(`[${i.where}] ${i.kind}: ${i.detail}`);
  } else {
    console.log("\n=== UI AUDIT: clean across every route (no console errors, exceptions, or failed requests) ===");
  }
  const hard = issues.filter((i) => i.kind === "pageerror" || i.kind.startsWith("console.error") || i.kind.startsWith("http.5") || i.kind === "requestfailed");
  expect(hard, hard.map((i) => `[${i.where}] ${i.kind}: ${i.detail}`).join("\n")).toEqual([]);
});

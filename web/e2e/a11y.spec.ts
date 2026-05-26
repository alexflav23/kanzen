import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility sweep (axe-core) across every built route. Fails on any serious/critical
 * WCAG 2.0/2.1 A/AA violation — the a11y leg of the hardening gate, run live against the
 * real backend. Light + dark themes both checked on the dashboard.
 */

type V = { route: string; id: string; impact: string; nodes: number; help: string };

async function scan(page: Page, route: string, sink: V[]) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  for (const v of results.violations) {
    if (v.impact === "serious" || v.impact === "critical") {
      sink.push({ route, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
    }
  }
}

test("a11y: every route is free of serious/critical violations", async ({ page }) => {
  const v: V[] = [];
  const nav = page.getByRole("navigation", { name: "Primary" });
  const go = async (link: string, headingRe: RegExp) => {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: headingRe }).first()).toBeVisible();
    await scan(page, link, v);
  };

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Flavian\./ })).toBeVisible();
  await scan(page, "Dashboard (light)", v);
  // dark theme
  await page.keyboard.press("Meta+d");
  await scan(page, "Dashboard (dark)", v);
  await page.keyboard.press("Meta+d");

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

  if (v.length) {
    console.log("\n=== A11Y VIOLATIONS (serious/critical) ===");
    for (const x of v) console.log(`[${x.route}] ${x.impact} · ${x.id} (${x.nodes} node(s)) — ${x.help}`);
  } else {
    console.log("\n=== A11Y: clean — no serious/critical violations across every route ===");
  }
  expect(v, v.map((x) => `[${x.route}] ${x.id} (${x.impact}) — ${x.help}`).join("\n")).toEqual([]);
});

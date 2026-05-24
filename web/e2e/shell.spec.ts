import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the shell renders in a real browser with StyleX applied.
test("app shell renders the brand, grouped nav and greeting", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toContainText("Kanzen");
  await expect(page.getByText("INVENTORY", { exact: true })).toBeVisible();
  await expect(nav.getByText("Inventory", { exact: true })).toBeVisible();
  await expect(nav.getByText("Finance", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Good morning, Flavian." })).toBeVisible();
});

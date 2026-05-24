import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the theme engine — toggle, ⌘D, persistence.
test("the nav toggle and ⌘D switch light/dark, and it persists", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("[data-theme]").first();
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.getByTestId("theme-toggle").click();
  await expect(root).toHaveAttribute("data-theme", "dark");

  // Persists across reload (localStorage).
  await page.reload();
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "dark");

  // ⌘D toggles back to light.
  await page.keyboard.press("Meta+d");
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "light");
});

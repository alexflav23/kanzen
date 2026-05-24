import { expect, test } from "./fixtures";

// Start logged-out (ignore the stored Principal session) so we can sign in as a different
// persona and watch the UI recalibrate to that identity's permissions (F02).
test.use({ storageState: { cookies: [], origins: [] } });

test("the nav recalibrates to the signed-in persona's permissions (Staff vs Principal)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dev-login")).toBeVisible();

  // Sign in as Marcia (Staff): the registry/finance/wealth nav is permission-gated away.
  await page.getByRole("button", { name: /Marcia/ }).click();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Properties", exact: true })).toBeVisible(); // ungated → present
  await expect(nav.getByRole("link", { name: "Inventory", exact: true })).toHaveCount(0);  // asset → none for Staff
  await expect(nav.getByRole("link", { name: "Finance", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Wealth", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Backup", exact: true })).toHaveCount(0);

  // Sign out, then in as Flavian (Principal): the same nav recalibrates to show everything.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("dev-login")).toBeVisible();
  await page.getByRole("button", { name: /Flavian/ }).click();
  await expect(nav.getByRole("link", { name: "Inventory", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Finance", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Wealth", exact: true })).toBeVisible();
});

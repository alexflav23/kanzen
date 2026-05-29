import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F42 entity management vs the REAL backend (Principal session; seeded
// entities "Flavian (Individual)" + "Wardian Family Trust"). Private Wealth is Principal-private.
test("entity management: ownership tree + create a child entity", async ({ page }) => {
  await page.goto("/wealth");
  await page.getByRole("link", { name: "Manage entities →" }).click();
  await expect(page.getByRole("heading", { name: "Entities" })).toBeVisible();
  await expect(page.getByTestId("entity-row").filter({ hasText: "Wardian Family Trust" })).toBeVisible();

  const name = `Subsidiary ${Date.now()}`;
  await page.getByRole("button", { name: "New entity" }).click();
  const modal = page.getByTestId("entity-modal");
  await modal.getByLabel("Name").fill(name);
  await modal.getByLabel("Kind").selectOption("company");
  await modal.getByLabel("Parent entity").selectOption({ label: "Flavian (Individual)" });
  await modal.getByRole("button", { name: "Add entity" }).click();

  // the new entity appears in the tree (nested under its parent)
  await expect(page.getByTestId("entity-row").filter({ hasText: name })).toBeVisible();
});

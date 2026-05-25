import { expect, test } from "./fixtures";

// F04 — asset collections vs the REAL backend (seeded "Watches" with the two watches).
test("collections lists the seeded Watches collection and expands to its members", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
  const watches = page.getByTestId("collection-row").filter({ hasText: "Watches" });
  await expect(watches).toBeVisible();
  await watches.click();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  await expect(page.getByText("Submariner Date")).toBeVisible();
});

test("New collection creates one that appears", async ({ page }) => {
  const name = `E2E Collection ${Date.now()}`;
  await page.goto("/collections");
  await page.getByRole("button", { name: "New collection" }).click();
  const modal = page.getByTestId("new-collection");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Name").fill(name);
  await modal.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(name)).toBeVisible();
});

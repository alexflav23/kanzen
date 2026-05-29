import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — Supplies (F35) vs the REAL backend (seeded shelf: Nespresso low,
// Dishwasher in-stock, Olive oil out → 2 need reordering). Principal session (can manage stock).
test("supplies page shows the seeded shelf and the reorder lens", async ({ page }) => {
  await page.goto("/supplies");
  await expect(page.getByRole("heading", { name: "Supplies" })).toBeVisible();
  await expect(page.getByText("Olive oil")).toBeVisible();
  await expect(page.getByText("Nespresso pods")).toBeVisible();
  // low + out items surface in the reorder banner
  await expect(page.getByTestId("reorder-banner")).toContainText("need reordering");
});

test("creating a supply then cycling its stock status updates the control", async ({ page }) => {
  const name = `E2E supply ${Date.now()}`;
  await page.goto("/supplies");
  await page.getByLabel("New supply").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(name)).toBeVisible();

  // the new supply's stock control — mark Out, then back to In stock (real /stock POST each time)
  const group = page.getByRole("group", { name: `Set stock for ${name}` });
  await group.getByRole("button", { name: "Out" }).click();
  await expect(group.getByRole("button", { name: "Out" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "In stock" }).click();
  await expect(group.getByRole("button", { name: "In stock" })).toHaveAttribute("aria-pressed", "true");
});

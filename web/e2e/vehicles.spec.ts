import { expect, test } from "./fixtures";

// F04/F22 — Vehicles is NOT a bespoke module: it's the asset registry filtered to the 'vehicle'
// vertical, using the same generic surface. Verifies the seeded vehicle shows + other verticals don't.
test("Vehicles shows the seeded vehicle and only vehicles (the registry's 'vehicle' vertical)", async ({ page }) => {
  await page.goto("/vehicles");
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
  await expect(page.getByText("Range Rover Autobiography")).toBeVisible();
  // other verticals (watches) are filtered out — proving it's vertical-scoped, not the whole registry
  await expect(page.getByText("Royal Oak 15500ST")).toHaveCount(0);
});

// F22 — template-driven typed create: the vehicle vertical's template renders typed Specification fields in the
// New-asset form; they round-trip to the asset's Specifications section.
test("creating a vehicle captures typed template specs (registration) that show on its detail", async ({ page }) => {
  await page.goto("/vehicles");
  await page.getByRole("button", { name: "New vehicle" }).click();
  await expect(page.getByTestId("new-asset")).toBeVisible();
  await expect(page.getByTestId("spec-fields")).toBeVisible(); // typed fields from the vehicle template
  const reg = `KAN ${Date.now() % 1000}`;
  const title = `Test Estate ${Date.now() % 100000}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Registration").fill(reg);
  await page.getByLabel("Mileage").fill("8200");
  await page.getByRole("button", { name: "Add asset" }).click();
  await expect(page.getByTestId("new-asset")).toHaveCount(0); // created

  await page.getByText(title).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("spec-row").filter({ hasText: reg })).toBeVisible(); // spec persisted + shown
});

test("Vehicles is reachable from the nav", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Vehicles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
});

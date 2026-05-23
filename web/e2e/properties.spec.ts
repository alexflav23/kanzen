import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the Properties list + the property "bible".
test("properties page shows the seed property cards", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByTestId("property-card")).toHaveCount(2);
  await expect(page.getByText("Wardian, Apt 5206")).toBeVisible();
});

test("opening a property shows its bible (overview, rooms, utilities, documents)", async ({ page }) => {
  await page.goto("/properties");
  await page.getByTestId("property-card").first().click();
  // Overview
  await expect(page.getByText("Particulars")).toBeVisible();
  await expect(page.getByText("Linked systems")).toBeVisible();
  await expect(page.getByText("At a glance")).toBeVisible();
  // Rooms
  await page.getByRole("button", { name: "Rooms" }).click();
  await expect(page.getByText(/Rooms · 5/)).toBeVisible();
  await expect(page.getByText("Music room")).toBeVisible();
  // Utilities
  await page.getByRole("button", { name: "Utilities" }).click();
  await expect(page.getByText("Thames Water")).toBeVisible();
  // Documents
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByText("Lease & deeds.pdf")).toBeVisible();
});

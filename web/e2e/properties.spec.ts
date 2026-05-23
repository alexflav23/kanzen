import { expect, test } from "@playwright/test";

// Browser e2e (Playwright): the Properties page.
test("properties page shows the seed property cards", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByTestId("property-card")).toHaveCount(2);
  await expect(page.getByText("Wardian, Apt 5206")).toBeVisible();
});

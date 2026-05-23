import { expect, test } from "@playwright/test";

// Browser e2e (Playwright): the People directory with the permit warning.
test("people page lists the team and flags the expiring permit", async ({ page }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByTestId("person-row")).toHaveCount(4);
  await expect(page.getByText(/Work permit · 50d/)).toBeVisible();
});

import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the People directory vs the REAL backend (seeded team).
test("people page lists the team and flags the expiring permit", async ({ page }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByText("Lorna")).toBeVisible();
  await expect(page.getByText("Siti")).toBeVisible();
  await expect(page.getByText(/Work permit · \d+d/)).toBeVisible(); // Siti's permit within 60d
});

import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the People directory vs the REAL backend (seeded team).
test("people page lists the team and flags the expiring permit", async ({ page }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  // scope to the page content — the nav's admin impersonation switcher also lists persona names
  const main = page.getByRole("main");
  await expect(main.getByText("Lorna")).toBeVisible();
  await expect(main.getByText("Siti")).toBeVisible();
  await expect(main.getByText(/Work permit · \d+d/)).toBeVisible(); // Siti's permit within 60d
});

import { expect, test } from "./fixtures";

// Uses the default stored Principal (Toby/admin) session. Drives the impersonation engine
// against the REAL backend: act-as a user → the whole UI recalibrates to them + a banner shows
// who's really driving → Stop restores the admin view.
test("an admin impersonates a user → banner + recalibrated nav → Stop restores admin", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Finance", exact: true })).toBeVisible(); // admin sees gated nav
  await expect(page.getByTestId("impersonate")).toBeVisible();

  // act-as Marcia (Staff)
  await page.getByLabel("Impersonate a user").selectOption("marcia@kanzen.local");
  await expect(page.getByTestId("impersonation-banner")).toBeVisible();
  await expect(page.getByText(/marcia@kanzen\.local/)).toBeVisible();
  // the UI recalibrates to Staff — the gated registry/finance nav is gone, and you can't chain-impersonate
  await expect(nav.getByRole("link", { name: "Finance", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Wealth", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("impersonate")).toHaveCount(0);

  // Stop → the real admin's session is restored
  await page.getByTestId("stop-impersonating").click();
  await expect(page.getByTestId("impersonation-banner")).toBeHidden();
  await expect(nav.getByRole("link", { name: "Finance", exact: true })).toBeVisible();
});

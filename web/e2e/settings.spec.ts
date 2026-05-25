import { expect, test } from "./fixtures";

// F02 — admin role-management: the Settings page edits the permission matrix the server enforces.
// Uses the default stored Flavian/principal (admin) session. Mutates a throwaway resource ("report")
// that nothing else references, then deletes it — so it can't interfere with other specs.
test("admin views the matrix, adds a rule, and it persists + can be cleared", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  // the principal's root admin grant is protected — rendered locked, not as an editable select
  await expect(page.getByText("admin 🔒").first()).toBeVisible();

  // add a fresh rule: staff → read on 'report'
  await page.getByLabel("Role").selectOption("staff");
  await page.getByLabel("Resource").fill("report");
  await page.getByLabel("Level").selectOption("read");
  await page.getByRole("button", { name: "Add rule" }).click();

  // it shows as an editable cell and survives a reload (persisted server-side)
  await expect(page.getByLabel("staff · report")).toHaveValue("read");
  await page.reload();
  await expect(page.getByLabel("staff · report")).toHaveValue("read");

  // clearing the cell to — deletes the rule; wait for the delete+refetch to settle (the row
  // disappears once nothing references it) before reloading, so we don't abort the DELETE.
  await page.getByLabel("staff · report").selectOption("");
  await expect(page.getByLabel("staff · report")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("staff · report")).toHaveCount(0);
});

// Settings is admin-gated — it appears in the nav for the admin (Flavian) principal.
test("Settings appears in the nav for an admin", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
});

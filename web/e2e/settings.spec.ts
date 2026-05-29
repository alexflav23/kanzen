import { expect, test } from "./fixtures";

// F02 — admin role-management: the Settings page edits the permission matrix the server enforces.
// Uses the default stored Flavian/principal (admin) session. Mutates a throwaway resource ("report")
// that nothing else references, then deletes it — so it can't interfere with other specs.
test("admin views the matrix, adds a rule, and it persists + can be cleared", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  await page.getByRole("tab", { name: "Advanced matrix" }).click(); // the matrix is the advanced view now
  // the principal's root admin grant is protected — rendered locked, not as an editable select
  await expect(page.getByText("admin 🔒").first()).toBeVisible();

  // add a fresh rule: staff → read on 'report' (exact label — "New role" also contains "Role")
  await page.getByLabel("Role", { exact: true }).selectOption("staff");
  await page.getByLabel("Resource").fill("report");
  await page.getByLabel("Level").selectOption("read");
  await page.getByRole("button", { name: "Add rule" }).click();

  // it shows as an editable cell and survives a reload (persisted server-side). Reload resets to the
  // Builder tab, so re-open the advanced matrix each time.
  await expect(page.getByLabel("staff · report")).toHaveValue("read");
  await page.reload();
  await page.getByRole("tab", { name: "Advanced matrix" }).click();
  await expect(page.getByLabel("staff · report")).toHaveValue("read");

  // clearing the cell to — deletes the rule; wait for the delete+refetch to settle (the row
  // disappears once nothing references it) before reloading, so we don't abort the DELETE.
  await page.getByLabel("staff · report").selectOption("");
  await expect(page.getByLabel("staff · report")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Advanced matrix" }).click();
  await expect(page.getByLabel("staff · report")).toHaveCount(0);
});

// F02 — fully DB-driven roles: the four defaults are seeded (editable, not hardcoded), and an admin
// can create + delete custom roles on the fly.
test("admin manages roles — defaults seeded; create + delete a custom role", async ({ page }) => {
  page.on("dialog", (d) => d.accept()); // accept the delete-confirm prompt
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  await page.getByRole("tab", { name: "Advanced matrix" }).click(); // role list + add-role live in the advanced view
  // the seeded household defaults are present (and non-system → deletable, so they render a Delete)
  await expect(page.getByText("Personal Assistant").first()).toBeVisible();
  await expect(page.getByLabel("Delete role Gardener")).toBeVisible();
  // system roles are protected — no delete control
  await expect(page.getByLabel("Delete role principal")).toHaveCount(0);

  // create a unique custom role → it appears (in the roles list + as a matrix column)
  const name = `E2E Role ${Date.now()}`;
  await page.getByLabel("New role").fill(name);
  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // delete it (cleanup) → disappears everywhere
  await page.getByLabel(`Delete role ${name}`).click();
  await expect(page.getByText(name)).toHaveCount(0);
});

// F19/W2 — the platform audited action log: an action taken in the app shows up in Settings → Audit log.
test("the Audit log records platform actions (action → log)", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/settings");
  // perform an audited action — create a permission set in the Builder (writes rbac.set.create)
  const name = `Audit Probe ${Date.now()}`;
  await page.getByLabel("New permission set").fill(name);
  await page.getByRole("button", { name: "Add set", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // it appears in the Audit log timeline
  await page.getByRole("tab", { name: "Audit log" }).click();
  await expect(page.getByTestId("audit-count")).toBeVisible();
  await expect(page.getByTestId("timeline-row").first()).toBeVisible();
  await expect(page.getByText(/rbac set create/).first()).toBeVisible();

  // cleanup the probe set — back via the Permissions top tab, then the Builder sub-tab
  await page.getByRole("tab", { name: "Permissions" }).click();
  await page.getByRole("tab", { name: "Builder" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Delete set" }).click();
});

// F-system (W8.5) — Settings is now a 4-tab screen; Integrations + Preferences are the new tabs.
test("Settings has Integrations + Preferences tabs", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("tab", { name: "Integrations" }).click();
  await expect(page.getByTestId("integration-row").first()).toBeVisible();
  await expect(page.getByText("Google Calendar")).toBeVisible();
  await page.getByRole("tab", { name: "Preferences" }).click();
  await expect(page.getByText("Approval threshold · UK")).toBeVisible();
});

// Settings is admin-gated — it appears in the nav for the admin (Flavian) principal.
test("Settings appears in the nav for an admin", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
});

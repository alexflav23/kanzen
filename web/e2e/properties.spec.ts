import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F03 Properties, end-to-end vs the REAL backend:
// authenticated shell → /api/properties + Bible aggregate/locations/defects from
// Postgres → rendered, no console or network errors (shared error-guard fixture).
test("lists the two seeded properties from the database", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByText("Wardian — Apt 5206")).toBeVisible();
  await expect(page.getByText("Singapore Residence")).toBeVisible();
  // ≥2 (other tests may add properties to the shared dev DB in parallel)
  expect(await page.getByTestId("property-card").count()).toBeGreaterThanOrEqual(2);
});

test("shows the per-property tallies on the cards", async ({ page }) => {
  await page.goto("/properties");
  // the prototype's four tiles, fed by the API counts (one set per card)
  for (const label of ["Rooms", "Assets", "Bills", "Vendors"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});

test("opening a property shows its Bible (overview, currency, rooms, defects) from the API", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  // Overview
  await expect(page.getByText("Particulars")).toBeVisible();
  await expect(page.getByText("At a glance")).toBeVisible();
  await expect(page.getByText("GBP").first()).toBeVisible(); // real per-property currency from the API
  await expect(page.getByText("Open defects")).toBeVisible();
  // Rooms (seeded location tree)
  await page.getByRole("button", { name: "Rooms" }).click();
  await expect(page.getByText("Living Room")).toBeVisible();
  await expect(page.getByText("Kitchen")).toBeVisible();
  // Defects (seeded punch list)
  await page.getByRole("button", { name: "Defects" }).click();
  await expect(page.getByTestId("defect-row").filter({ hasText: "Dishwasher not draining" })).toBeVisible();
});

// W4 (F03) — Overview depth: full particulars + the linked-systems card (references only, never a secret).
test("the Bible Overview shows full particulars and the linked-systems references", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  // full particulars (address/type/ownership/building-management from the API)
  await expect(page.getByText("Wardian, 9 Wards Place, London E14")).toBeVisible();
  await expect(page.getByText("United Kingdom")).toBeVisible(); // friendly country from jurisdiction
  await expect(page.getByText("Ballymore — Wardian Estate Management")).toBeVisible();
  // linked systems — task project resolved to its name + the reference-only assurance
  await expect(page.getByText("Linked systems")).toBeVisible();
  await expect(page.getByText("Wardian — Household")).toBeVisible(); // task project name (not its id)
  await expect(page.getByText(/never credentials or secrets/i)).toBeVisible();
});

// W4 (F03) — the Bible is the full property record: what's in it (Assets, server-scoped via ?property=),
// what keeps it running (Maintenance), and its papers (Documents) — each scoped to this property.
test("the Bible's Assets tab lists items located in this property", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Assets" }).click();
  // a placed household item (seeded into a Wardian room) + its acquisition value
  const row = page.getByTestId("bible-asset-row").filter({ hasText: "Royal Oak 15500ST" });
  await expect(row).toBeVisible();
  // clicking through opens the asset's registry detail
  await row.click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();
});

test("the Bible's Utilities tab lists the property's recurring bills", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Utilities" }).click();
  // the seeded Wardian utility bills
  await expect(page.getByTestId("bible-bill-row").filter({ hasText: "Thames Water" })).toBeVisible();
  await expect(page.getByTestId("bible-bill-row").filter({ hasText: "British Gas" })).toBeVisible();
});

test("the Bible's Maintenance tab is scoped to this property's plans", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Maintenance" }).click();
  await expect(page.getByTestId("bible-plan-row").filter({ hasText: "Boiler service" })).toBeVisible();
});

test("the Bible's Documents tab shows property papers, marks originals, and scopes by property", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByTestId("bible-doc-row").filter({ hasText: "EPC Certificate.pdf" })).toBeVisible();
  await expect(page.getByText("original").first()).toBeVisible(); // immutable source document
  // the Singapore tenancy agreement (other property) is not here
  await expect(page.getByText("Tenancy Agreement — Singapore.pdf")).toHaveCount(0);
});

// W4 (F03) — location-tree depth: per-node item lists, rename, move/reparent, and the delete-guard.
test("a tree node shows its item count and expands to the items located there", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Rooms" }).click();
  // the seeded 'cabinet' (a richer kind) holds the watches (count flexes: a parallel test may relocate one)
  const cabinet = page.getByTestId("room-row").filter({ hasText: "Watch Cabinet" });
  await expect(cabinet).toBeVisible();
  await expect(cabinet.getByText(/\d+ item/)).toBeVisible(); // a per-node item count badge
  await page.getByRole("button", { name: "Expand Watch Cabinet" }).click();
  // the Submariner stays in the cabinet (unlike the Royal Oak, which other suites relocate)
  await expect(page.getByTestId("node-asset-row").filter({ hasText: "Submariner Date" })).toBeVisible();
});

test("the delete-guard blocks removing a node that still holds items", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: "Delete Watch Cabinet" }).click();
  await page.getByRole("button", { name: "Confirm delete Watch Cabinet" }).click();
  await expect(page.getByTestId("tree-error")).toContainText("item"); // "move 2 item(s) first"
  await expect(page.getByTestId("room-row").filter({ hasText: "Watch Cabinet" })).toBeVisible(); // not deleted
});

test("a node can be renamed, moved, and (when empty) deleted (Manager+)", async ({ page }) => {
  const a = `Cellar ${Date.now()}`;
  const renamed = `Wine Cellar ${Date.now()}`;
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Rooms" }).click();

  // create
  await page.getByRole("button", { name: "Add room" }).click();
  await page.getByTestId("add-room").getByLabel("Room name").fill(a);
  await page.getByTestId("add-room").getByRole("button", { name: "Add room" }).click();
  await expect(page.getByText(a)).toBeVisible();

  // rename
  await page.getByRole("button", { name: `Rename ${a}` }).click();
  await page.getByTestId("edit-room").getByLabel("Location name").fill(renamed);
  await page.getByTestId("edit-room").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  // move it inside the Study (reparent), then delete it (empty → allowed)
  await page.getByRole("button", { name: `Move ${renamed}` }).click();
  await page.getByTestId("move-room").getByLabel("New parent").selectOption({ label: "Study" });
  await page.getByTestId("move-room").getByRole("button", { name: "Move" }).click();
  await expect(page.getByTestId("move-room")).toHaveCount(0);

  await page.getByRole("button", { name: `Delete ${renamed}` }).click();
  await page.getByRole("button", { name: `Confirm delete ${renamed}` }).click();
  await expect(page.getByText(renamed)).toHaveCount(0); // empty node removed
});

// W4 (F03) — defect ops: assign a vendor (F09), spawn a fix-task (F06), edit particulars.
test("a defect shows its assigned vendor (seeded)", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Defects" }).click();
  // the dishwasher defect is seeded assigned to Thames Plumbing (V2_79)
  const picker = page.getByLabel("Assign vendor for Dishwasher not draining fully");
  await expect(picker.locator("option:checked")).toHaveText("Thames Plumbing");
});

test("a defect can be assigned a vendor, spawn a fix-task, and be edited (Manager+)", async ({ page }) => {
  const title = `E2E defect ${Date.now()}`;
  const edited = `${title} (edited)`;
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible();
  await page.getByRole("button", { name: "Defects" }).click();

  // raise an isolated defect (don't mutate the seeded ones)
  await page.getByRole("button", { name: "Report defect" }).click();
  await page.getByTestId("report-defect").getByLabel("Defect title").fill(title);
  await page.getByTestId("report-defect").getByRole("button", { name: "Report defect" }).click();
  await expect(page.getByText(title)).toBeVisible();

  // assign the approved+insured plumber
  await page.getByLabel(`Assign vendor for ${title}`).selectOption({ label: "Thames Plumbing" });
  await expect(page.getByLabel(`Assign vendor for ${title}`).locator("option:checked")).toHaveText("Thames Plumbing");

  // spawn a fix-task into the property's task project (button → "Task created")
  await page.getByRole("button", { name: `Create task for ${title}` }).click();
  await expect(page.getByRole("button", { name: `Create task for ${title}` })).toHaveCount(0);

  // edit the particulars
  await page.getByRole("button", { name: `Edit ${title}` }).click();
  await page.getByTestId("edit-defect").getByLabel("Defect title").fill(edited);
  await page.getByTestId("edit-defect").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(edited)).toBeVisible();
});

test("a defect can be reported and moved through its lifecycle (Manager+)", async ({ page }) => {
  const title = `Leaky tap ${Date.now()}`;
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await page.getByRole("button", { name: "Defects" }).click();

  await page.getByRole("button", { name: "Report defect" }).click();
  const modal = page.getByTestId("report-defect");
  await modal.getByLabel("Defect title").fill(title);
  await modal.getByLabel("Severity").selectOption("high");
  await modal.getByRole("button", { name: "Report defect" }).click();

  const row = page.getByTestId("defect-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText("open")).toBeVisible();
  await page.getByRole("button", { name: `Resolve ${title}` }).click(); // open → resolved
  await expect(row.getByText("resolved")).toBeVisible();
});

test("a room can be added to the property (Manager+)", async ({ page }) => {
  const name = `Wine Cellar ${Date.now()}`;
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  await expect(page.getByText("Particulars")).toBeVisible(); // wait for the Bible (the list's "Rooms" tallies would shadow the tab)
  await page.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: "Add room" }).click();
  const modal = page.getByTestId("add-room");
  await modal.getByLabel("Room name").fill(name);
  await modal.getByRole("button", { name: "Add room" }).click();
  await expect(page.getByText(name)).toBeVisible();
});

// W4 (F03) — property admin: edit particulars + archive. Operate on a freshly-created property so we never
// mutate the shared Wardian seed other tests assert against.
test("a property's particulars can be edited (Manager+)", async ({ page }) => {
  const name = `EditProp ${Date.now()}`;
  const renamed = `${name} (renamed)`;
  await page.goto("/properties");
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByTestId("add-property").getByPlaceholder("e.g. Wardian — Apt 5206").fill(name);
  await page.getByTestId("add-property").getByRole("button", { name: "Add property" }).click();
  await page.getByText(name).click();
  await expect(page.getByText("Particulars")).toBeVisible();

  await page.getByRole("button", { name: "Edit property" }).click();
  const modal = page.getByTestId("edit-property");
  await modal.getByLabel("Property name").fill(renamed);
  await modal.getByLabel("Address").fill("1 Test Street, London");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("edit-property")).toHaveCount(0);
  await expect(page.getByText(renamed)).toBeVisible(); // cover name updates from the refetch
  await expect(page.getByText("1 Test Street, London")).toBeVisible(); // particulars updated
});

test("a property can be archived — hidden from the default list, records preserved (Manager+)", async ({ page }) => {
  const name = `ArchiveMe ${Date.now()}`;
  await page.goto("/properties");
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByTestId("add-property").getByPlaceholder("e.g. Wardian — Apt 5206").fill(name);
  await page.getByTestId("add-property").getByRole("button", { name: "Add property" }).click();
  await page.getByText(name).click();
  await expect(page.getByText("Particulars")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await expect(page).toHaveURL(/\/properties$/); // returned to the list
  await expect(page.getByText(name)).toHaveCount(0); // archived → hidden from the default list
});

test("Add property creates a property that appears in the list", async ({ page }) => {
  const name = `E2E House ${Date.now()}`;
  await page.goto("/properties");
  await page.getByRole("button", { name: "Add property" }).click();
  const modal = page.getByTestId("add-property");
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder("e.g. Wardian — Apt 5206").fill(name);
  await modal.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByText(name)).toBeVisible();
});

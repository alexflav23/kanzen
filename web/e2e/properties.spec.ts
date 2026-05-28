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

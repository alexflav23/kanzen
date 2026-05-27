import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — shopping lists vs the REAL backend (seeded "Grocery — Wardian").
test("lists page shows the seeded grocery list with its approval queue", async ({ page }) => {
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();

  // Open the Wardian grocery list from the master rail.
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();

  await expect(page.getByText("Whole milk", { exact: false })).toBeVisible();
  await expect(page.getByText(/need approval/)).toBeVisible(); // chip count for the seeded staff proposals
  await expect(page.getByTestId("approval-row").filter({ hasText: "Truffle" })).toBeVisible();
  await expect(page.getByText(/est\. £95/)).toBeVisible();
});

test("a list can be reconfigured (property · frequency · vendor)", async ({ page }) => {
  const name = `Config List ${Date.now()}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: "New list" }).click();
  await page.getByTestId("new-list").getByLabel("List name").fill(name);
  await page.getByTestId("new-list").getByRole("button", { name: "Create list" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();

  await page.getByTestId("configure-list").click();
  const m = page.getByTestId("edit-list");
  await m.getByLabel("Frequency").selectOption("fortnightly");
  await m.getByLabel("Vendor").fill("Ocado");
  await m.getByRole("button", { name: "Save" }).click();

  // reopen → the change persisted server-side
  await page.getByTestId("configure-list").click();
  await expect(page.getByTestId("edit-list").getByLabel("Frequency")).toHaveValue("fortnightly");
  await expect(page.getByTestId("edit-list").getByLabel("Vendor")).toHaveValue("Ocado");
});

test("adding an item to a list makes it appear", async ({ page }) => {
  const item = `E2E item ${Date.now()}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText(item)).toBeVisible();
});

// Self-seeding + idempotent: impersonate Marcia (Staff) to PROPOSE a unique item (lands as
// needs_approval), stop impersonating, then approve it as Principal and watch it leave the queue.
// Doubles as an end-to-end check of the token-derived identity (the propose path runs as Staff).
test("a Staff proposal needs approval; the Principal approves it out of the queue", async ({ page }) => {
  const item = `Approve-me ${Date.now()}`;

  await page.goto("/");
  await page.getByLabel("Impersonate a user").selectOption("marcia@kanzen.local");
  await expect(page.getByTestId("impersonation-banner")).toBeVisible();
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  // As Staff there are no Approve/Decline controls (canDecide is false from the token role).
  await expect(page.getByRole("button", { name: /^Approve / })).toHaveCount(0);
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();

  await page.getByTestId("stop-impersonating").click();
  await expect(page.getByTestId("impersonation-banner")).toBeHidden();

  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  const row = page.getByTestId("approval-row").filter({ hasText: item });
  await expect(row).toBeVisible(); // the staff proposal is awaiting the Principal
  await page.getByRole("button", { name: `Approve ${item}` }).click();
  await expect(row).toHaveCount(0); // approved → leaves the awaiting-you queue
});

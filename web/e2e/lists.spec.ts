import { randomBytes } from "node:crypto";
import { expect, test } from "./fixtures";

// A unique, valid 1×1 PNG (random trailing bytes keep the sha256 fresh so the upload never
// dedups onto a stale object whose in-memory bytes were dropped on a backend restart).
const uniquePng = () =>
  Buffer.concat([
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
    randomBytes(8),
  ]);

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

  // the detail header re-renders from the refetched list — proves the config persisted
  // ("Delivers via …" is detail-only; the rail shows just the vendor name)
  await expect(page.getByText("Delivers via Ocado")).toBeVisible();
});

test("adding an item to a list makes it appear", async ({ page }) => {
  const item = `E2E item ${Date.now()}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText(item)).toBeVisible();
});

// Item photos — drag-and-drop / pick an image into an item's media gallery; it uploads (F05
// document, immutable original) and renders as a thumbnail from a signed capability URL.
test("an item's photos upload and render in its gallery", async ({ page }) => {
  const item = `Photo item ${Date.now()}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();

  const row = page.getByTestId("list-item-row").filter({ hasText: item });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Photos for ${item}` }).click();

  // pick a file via the (visually-hidden) input — uploads + links + renders a thumbnail
  await row.getByLabel("Upload photos").setInputFiles({ name: "fridge.png", mimeType: "image/png", buffer: uniquePng() });
  const thumb = row.locator("img"); // the <img> thumbnail (not the SVG icons)
  await expect(thumb).toBeVisible();
  // the thumbnail actually loaded its bytes from the signed capability URL (not a broken image)
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // remove it again (keeps the dev DB tidy) — the thumbnail goes away
  await row.getByRole("button", { name: /^Delete photo / }).click();
  await expect(row.locator("img")).toHaveCount(0);
});

// Substitutions ("sub items") — an alternative to buy if the primary is out of stock.
// Add a confirmed item, then attach a substitute to it; it nests under the item, not as its own row.
test("an item can carry a substitute that nests beneath it", async ({ page }) => {
  const stamp = Date.now();
  const item = `Primary ${stamp}`;
  const sub = `Alt brand ${stamp}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();

  const row = page.getByTestId("list-item-row").filter({ hasText: item });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Add substitute" }).click();
  await row.getByLabel(`Substitute for ${item}`).fill(sub);
  await row.getByRole("button", { name: "Add", exact: true }).click();

  // The substitute renders nested under its item as a sub-item ("or <name>").
  const subItem = page.getByTestId("sub-item").filter({ hasText: sub });
  await expect(subItem).toBeVisible();
  await expect(subItem).toContainText("or");
  // It is part of the parent's row group, not a stand-alone top-level item row.
  await expect(row.getByTestId("sub-item").filter({ hasText: sub })).toBeVisible();
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

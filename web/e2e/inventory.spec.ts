import { randomBytes } from "node:crypto";
import { expect, test } from "./fixtures";

// A unique, valid 1×1 PNG (random trailing bytes keep the sha256 fresh — no dedup onto a stale
// object whose in-memory bytes were dropped on a backend restart).
const uniquePng = () =>
  Buffer.concat([
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
    randomBytes(8),
  ]);

// Browser e2e (Playwright) — the Inventory registry vs the REAL backend (seeded assets).
test("inventory shows the seeded registry", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByText("Assets shown")).toBeVisible();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
});

test("the category rail narrows; Clear restores", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: /^Watches/ }).click();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  await expect(page.getByText("Submariner Date")).toBeVisible();
  await expect(page.getByText("1959 Les Paul Standard")).toHaveCount(0); // filtered out
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
});

test("search narrows by maker", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByLabel("Search inventory").fill("Gibson");
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
  await expect(page.getByText("Royal Oak 15500ST")).toHaveCount(0);
});

test("the list view renders rows", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  expect(await page.getByTestId("asset-row").count()).toBeGreaterThanOrEqual(5);
});

test("opening an asset shows its detail + specifications", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();
  await expect(page.getByText("Specifications")).toBeVisible();
  await expect(page.getByText("AP-15500")).toBeVisible(); // from the JSONB attributes
  // F19 lifecycle timeline (seeded acquisition event) + lifetime cost
  await expect(page.getByText("Lifecycle")).toBeVisible();
  await expect(page.getByText("Lifetime cost")).toBeVisible();
  // F04 in-collections: Royal Oak is seeded in the "Watches" collection
  await expect(page.getByTestId("asset-collections")).toContainText("Watches");
});

test("an asset is a living record — log a timeline event + record a valuation", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();

  // log a lifecycle event → it appears on the timeline
  await page.getByRole("button", { name: "Log event" }).click();
  const ev = page.getByTestId("log-event");
  await expect(ev).toBeVisible();
  await ev.getByLabel("Event type").selectOption("serviced");
  await ev.getByLabel("Note").fill("Annual service");
  await ev.getByRole("button", { name: "Log event" }).click();
  await expect(page.getByText("Annual service").first()).toBeVisible(); // .first(): the dev DB accumulates events across runs

  // record a valuation (Principal) → it appears in the Valuations history
  await page.getByRole("button", { name: "Record valuation" }).click();
  const val = page.getByTestId("record-valuation");
  await expect(val).toBeVisible();
  await val.getByLabel("Amount").fill("38000");
  await val.getByRole("button", { name: "Record" }).click();
  await expect(page.getByTestId("valuation-row").first()).toBeVisible();
});

// F04/F05 — the asset detail carries a Photos gallery (reuses MediaGallery + the F05 doc/blob
// plumbing). Upload renders a thumbnail from a signed capability URL; remove leaves no dangling
// link (so later asset-detail opens stay clean even after a backend rebuild drops the bytes).
test("an asset detail shows a Photos gallery; upload renders, remove clears", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();
  await expect(page.getByText("Photos", { exact: true })).toBeVisible();

  await page.getByLabel("Upload photos").setInputFiles({ name: "watch.png", mimeType: "image/png", buffer: uniquePng() });
  const thumb = page.getByRole("img", { name: "watch.png" }); // alt = file name (not the SVG icons)
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // clicking the thumbnail opens the full-resolution lightbox; Escape closes it
  await page.getByRole("button", { name: "View watch.png" }).click();
  await expect(page.getByTestId("lightbox")).toBeVisible();
  await expect.poll(() => page.getByTestId("lightbox-image").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lightbox")).toHaveCount(0);

  // remove it again — no dangling photo link is left on the shared seeded asset
  await page.getByRole("button", { name: "Remove photo watch.png" }).click();
  await expect(page.getByRole("img", { name: "watch.png" })).toHaveCount(0);
});

// F04 (W1.4) — move / custody / hero photo. Move + custody persist (realistic); the hero photo
// is removed at the end so no dangling hero survives a backend rebuild (which drops in-memory bytes).
test("an asset can be moved, have its custody changed, and a hero photo set", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();

  // Move → the Location key fact resolves + a location-history row appears
  await page.getByTestId("move-btn").click();
  const mv = page.getByTestId("move-asset");
  await mv.getByLabel("Property").selectOption({ label: "Wardian — Apt 5206" });
  await mv.getByLabel("Location").selectOption({ index: 1 });
  await mv.getByRole("button", { name: "Move" }).click();
  await expect(page.getByTestId("move-asset")).toHaveCount(0); // modal closed → succeeded
  await expect(page.getByTestId("kv-location")).toContainText("Wardian"); // resolved property label
  await expect(page.getByTestId("location-history-row").first()).toBeVisible();

  // Change custody → the Custody key fact updates + a custody-history row appears
  await page.getByTestId("custody-btn").click();
  const cu = page.getByTestId("change-custody");
  await cu.getByLabel("Custody").selectOption("with_repair_shop");
  await cu.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("kv-custody")).toContainText("With repair shop");
  await expect(page.getByTestId("custody-history-row").first()).toBeVisible();

  // Upload a photo, set it as hero → the hero banner renders; then remove it (cleanup)
  await page.getByLabel("Upload photos").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: uniquePng() });
  await expect(page.getByRole("img", { name: "hero.png" })).toBeVisible();
  await page.getByRole("button", { name: "Set hero.png as hero photo" }).click();
  await expect(page.getByTestId("asset-hero")).toBeVisible();
  await page.getByRole("button", { name: "Remove photo hero.png" }).click();
  await expect(page.getByTestId("asset-hero")).toHaveCount(0); // hero clears once its photo is gone
});

// F04 (W1.5) — asset groups: peer groupings (create-or-reuse by name + kind) on the asset detail.
test("an asset can be added to and removed from a group", async ({ page }) => {
  const group = `Order ${Date.now()}`;
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();

  const section = page.getByTestId("asset-groups");
  await section.getByTestId("add-group").click();
  await section.getByLabel("Group name").fill(group);
  await section.getByLabel("Group kind").selectOption("order");
  await section.getByRole("button", { name: "Add" }).click();

  const chip = section.getByTestId("group-chip").filter({ hasText: group });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("order"); // the kind badge
  await chip.getByRole("button", { name: `Remove from group ${group}` }).click();
  await expect(section.getByTestId("group-chip").filter({ hasText: group })).toHaveCount(0);
});

// Brand catalogue (specs/03) — launching create from Vehicles offers a catalogue-backed,
// car-brand autocomplete + a vehicle-appropriate placeholder (not a watch brand).
test("creating from Vehicles offers a catalogue-backed car-brand autocomplete", async ({ page }) => {
  await page.goto("/vehicles");
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
  await page.getByRole("button", { name: "New vehicle" }).click();
  const modal = page.getByTestId("new-asset");
  await expect(modal).toBeVisible();

  const maker = modal.getByLabel("Maker");
  // placeholder is the catalogue's top car brand for Vehicles (not the old hardcoded watch brand)
  await expect(maker).toHaveAttribute("placeholder", /e\.g\. (Mercedes-Benz|Porsche|BMW|Ferrari|Audi)/);
  // the <datalist> is populated with car brands from the global catalogue
  const options = await maker.evaluate((el: HTMLInputElement) => [...(el.list?.options ?? [])].map((o) => o.value));
  expect(options.some((o) => /Mercedes-Benz|Porsche|Ferrari|BMW|Audi|Bentley/.test(o))).toBeTruthy();
});

// F33 — tags display on the asset detail: add (create-or-reuse) + remove chips.
test("an asset's tags can be added and removed", async ({ page }) => {
  const tag = `vintage-${Date.now()}`;
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();

  await page.getByTestId("add-tag").click();
  await page.getByLabel("Add a tag").fill(tag);
  await page.getByLabel("Add a tag").press("Enter");
  const chip = page.getByTestId("tag-chip").filter({ hasText: tag });
  await expect(chip).toBeVisible();

  await chip.getByRole("button", { name: `Remove tag ${tag}` }).click();
  await expect(page.getByTestId("tag-chip").filter({ hasText: tag })).toHaveCount(0);
});

test("an asset's key facts can be edited", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await page.getByRole("button", { name: "Edit" }).click();
  const m = page.getByTestId("edit-asset");
  await expect(m).toBeVisible();
  const maker = `Audemars Piguet · ${Date.now() % 100000}`; // unique → no collision with other specs
  await m.getByLabel("Maker").fill(maker);
  await m.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(maker)).toBeVisible();
});

test("the filter rail facets by property + shows the acquisition-value rollup", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByTestId("value-total")).toBeVisible(); // acquisition-value summary strip
  // Property facet (collapsed by default) → expand → pick Wardian → active chip
  await page.getByRole("button", { name: "Property", exact: true }).click();
  await page.getByRole("button", { name: "Wardian — Apt 5206", exact: true }).click();
  await expect(page.getByText(/Property · Wardian/)).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click(); // clears all facets
  await expect(page.getByText(/Property · Wardian/)).toHaveCount(0);
});

test("New asset: full create form (location + acquisition) round-trips to detail", async ({ page }) => {
  const title = `E2E Asset ${Date.now()}`;
  await page.goto("/inventory");
  await page.getByRole("button", { name: "New asset" }).click();
  const modal = page.getByTestId("new-asset");
  await modal.getByLabel("Title").fill(title);
  await modal.getByLabel("Category").selectOption({ label: "Glassware" });
  // Location: Wardian (has seeded rooms) → its first room
  await modal.getByLabel("Property").selectOption({ label: "Wardian — Apt 5206" });
  await expect(modal.getByLabel("Location").locator("option")).not.toHaveCount(1); // room tree loaded
  await modal.getByLabel("Location").selectOption({ index: 1 });
  // Acquisition
  await modal.getByLabel("Acquisition cost").fill("1850");
  await modal.getByLabel("Acquired on").fill("2026-03-14");
  await modal.getByRole("button", { name: "Add asset" }).click();

  await expect(page.getByText(title)).toBeVisible();
  await page.getByText(title).click(); // open detail
  await expect(page.getByText("Acquired")).toBeVisible(); // the acquired-date key fact rendered
  await expect(page.getByText("14 Mar 2026")).toBeVisible();
});

test("nav links route from Dashboard to Inventory", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Flavian\./ })).toBeVisible();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});

import { expect, test } from "./fixtures";

// Browser e2e (Playwright): grouped navigation — built pages route to content,
// every not-yet-built nav item routes cleanly to the "Coming soon" stub.
const BUILT: [string, RegExp][] = [
  ["Dashboard", /Good morning, Flavian\./],
  ["Inbox", /Inbox/],
  ["Notifications", /Notifications/],
  ["Inventory", /Inventory/],
  ["Collections", /Collections/],
  ["Vehicles", /Vehicles/],
  ["Properties", /Properties/],
  ["People", /People/],
  ["Finance", /Bills, expenses/],
  ["Wealth", /Net worth/],
  ["Documents", /Documents/],
  ["Vendors", /Vendors/],
  ["Tasks", /Tasks/],
  ["Lists", /Lists/],
  ["Maintenance", /Maintenance/],
  ["Calendar", /Calendar/],
  ["Insights", /Insights/],
  ["Backup", /Backup/],
];

// Every nav item now routes to a real page (Vehicles = the asset-registry 'vehicle' vertical).
// The "Coming soon" stub only remains as the catch-all for genuinely-unknown paths.

test("built nav items route to their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [item, heading] of BUILT) {
    await nav.getByRole("link", { name: item, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("an unknown route shows the clean 'Coming soon' fallback", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText("Coming soon.")).toBeVisible();
});

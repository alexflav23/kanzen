import { expect, test } from "./fixtures";

// Browser e2e (Playwright): grouped navigation — built pages route to content,
// every not-yet-built nav item routes cleanly to the "Coming soon" stub.
const BUILT: [string, RegExp][] = [
  ["Dashboard", /Good morning, Toby\./],
  ["Inventory", /Inventory/],
  ["Properties", /Properties/],
  ["People", /People/],
  ["Finance", /Bills, expenses/],
  ["Documents", /Documents/],
  ["Vendors", /Vendors/],
  ["Tasks", /Tasks/],
  ["Lists", /Lists/],
];

const STUBS = ["Inbox", "Collections", "Insights", "Calendar", "Maintenance", "Vehicles", "Backup", "Settings"];

test("built nav items route to their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const [item, heading] of BUILT) {
    await nav.getByRole("link", { name: item, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("every not-yet-built nav item routes to a clean stub", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const item of STUBS) {
    await nav.getByRole("link", { name: item, exact: true }).click();
    await expect(page.getByText("Coming soon.")).toBeVisible();
  }
});

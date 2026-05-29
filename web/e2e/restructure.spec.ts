import { expect, test } from "./fixtures";

// F24 — asset restructure: split an asset into children (cost allocated), with Undo (reverse the op).
// Uses a throwaway asset so it never disturbs the seeded registry.
test("an asset can be split into children and the op undone", async ({ page }) => {
  const title = `Split Me ${Date.now()}`;
  await page.goto("/inventory");
  await page.getByRole("button", { name: "New asset" }).click();
  const m = page.getByTestId("new-asset");
  await m.getByLabel("Title").fill(title);
  await m.getByLabel("Acquisition cost").fill("900");
  await m.getByRole("button", { name: "Add asset" }).click();

  await page.getByText(title).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Split into 3 → result + cost allocation (Restructure lives in the header Actions menu)
  await page.getByTestId("asset-actions").click();
  await page.getByTestId("restructure-btn").click();
  const r = page.getByTestId("restructure");
  await r.getByLabel("Split count").fill("3");
  await r.getByTestId("split-go").click();
  await expect(page.getByTestId("restructure-result")).toContainText("Split into 3");

  // Undo → back to the form (op reversed)
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("restructure-result")).toHaveCount(0);
});

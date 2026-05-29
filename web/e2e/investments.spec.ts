import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F40 record-a-trade vs the REAL backend (Principal; seeded VWRL lot under
// "Flavian (Individual)"). Records investments; never executes a trade. Buy opens a lot; sell closes
// FIFO and returns the realised gain. (Buy-then-sell keeps the seeded lot from depleting across runs.)
test("record a buy then a sell, surfacing the realised gain", async ({ page }) => {
  await page.goto("/wealth");
  await page.getByRole("button", { name: "Record trade" }).click();
  let modal = page.getByTestId("trade-modal");
  await expect(modal).toBeVisible();

  // pick the VWRL security (it has the seeded lot under the default entity)
  const sel = modal.getByLabel("Security");
  const vwrl = await sel.locator("option", { hasText: "VWRL" }).getAttribute("value");
  await sel.selectOption(vwrl!);

  // Buy 2 @ £200
  await modal.getByLabel("Quantity").fill("2");
  await modal.getByLabel("Cost").fill("200");
  await modal.getByRole("button", { name: "Record buy" }).click();
  await expect(modal).toBeHidden(); // a buy closes the modal on success

  // Sell 1 @ £100 → realised gain/loss surfaces
  await page.getByRole("button", { name: "Record trade" }).click();
  modal = page.getByTestId("trade-modal");
  await modal.getByRole("tab", { name: "Sell" }).click();
  await modal.getByLabel("Security").selectOption(vwrl!);
  await modal.getByLabel("Quantity").fill("1");
  await modal.getByLabel("Proceeds").fill("100");
  await modal.getByRole("button", { name: "Record sell" }).click();
  await expect(page.getByTestId("trade-result")).toContainText("realised");
});

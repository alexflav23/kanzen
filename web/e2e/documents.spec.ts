import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Documents evidence store vs the REAL backend.
test("documents page loads with KPI tiles", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByText("Evidence store · immutable originals")).toBeVisible();
  expect(await page.getByTestId("doc-kpi").count()).toBe(4); // total / storage / immutable / agent-filed
});

test("grid (default) + list toggle both render documents", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByTestId("doc-card").first()).toBeVisible(); // grid is the default
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByTestId("doc-row").first()).toBeVisible();
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.getByTestId("doc-card").first()).toBeVisible();
});

test("uploading a PDF stores it and previews it inline (in-browser PDF viewer)", async ({ page }) => {
  const name = `e2e-${Date.now()}.pdf`;
  await page.goto("/documents");
  await page.getByTestId("doc-file").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 E2E receipt ${Date.now()}`),
  });
  // it appears as a grid card; clicking opens the in-app PDF viewer (iframe)
  const card = page.getByTestId("doc-card").filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("doc-preview")).toBeVisible();
  await expect(page.getByTestId("pdf-frame")).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(page.getByTestId("doc-preview")).toBeHidden();
});

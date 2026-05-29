import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Documents evidence store vs the REAL backend.
test("documents page loads with KPI tiles", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByText("Evidence store · immutable originals")).toBeVisible();
  expect(await page.getByTestId("doc-kpi").count()).toBe(4); // total / storage / immutable / agent-filed
});

test("uploading a PDF stores it, lists it, and previews it inline (iframe)", async ({ page }) => {
  const name = `e2e-${Date.now()}.pdf`;
  await page.goto("/documents");
  await page.getByTestId("doc-file").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4 E2E receipt ${Date.now()}`),
  });
  const row = page.getByTestId("doc-row").filter({ hasText: name });
  await expect(row).toBeVisible();

  // click the row → in-app preview opens with a PDF iframe
  await row.click();
  await expect(page.getByTestId("doc-preview")).toBeVisible();
  await expect(page.getByTestId("pdf-frame")).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(page.getByTestId("doc-preview")).toBeHidden();
});

import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Documents evidence store vs the REAL backend.
test("documents page loads", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByText("immutable originals")).toBeVisible();
});

test("uploading a file stores it and lists it (immutable original)", async ({ page }) => {
  const name = `e2e-${Date.now()}.pdf`;
  await page.goto("/documents");
  await page.getByTestId("doc-file").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(`E2E receipt ${Date.now()}`),
  });
  await expect(page.getByText(name)).toBeVisible();
});

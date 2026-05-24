import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — Backup vs the REAL backend. Export produces a self-descriptive
// manifest; validate verifies checksums; dry-run reports the plan (writes nothing).
test("export → manifest, validate, and a dry-run restore that writes nothing", async ({ page }) => {
  await page.goto("/backup");
  await expect(page.getByRole("heading", { name: /Backup/ })).toBeVisible();

  await page.getByTestId("run-export").click();
  await expect(page.getByTestId("manifest-counts")).toBeVisible(); // real entity counts

  await page.getByTestId("validate").click();
  await expect(page.getByTestId("validate-result")).toBeVisible();
  await expect(page.getByText("valid", { exact: true })).toBeVisible(); // the validation pill

  await page.getByTestId("dry-run").click();
  await expect(page.getByTestId("dryrun-result")).toBeVisible();
  await expect(page.getByText("nothing written")).toBeVisible();
});

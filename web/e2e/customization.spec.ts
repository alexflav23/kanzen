import { expect, test } from "./fixtures";

// F33 — Principal-define extensibility: tags, custom-field definitions, taxonomy trees.
test("the Customization page exposes the three editors and creates a tag", async ({ page }) => {
  await page.goto("/customization");
  await expect(page.getByRole("heading", { name: "Customization" })).toBeVisible();
  await expect(page.getByText("Tags", { exact: true })).toBeVisible();
  await expect(page.getByText("Custom fields", { exact: true })).toBeVisible();
  await expect(page.getByText("Taxonomies", { exact: true })).toBeVisible();

  // create a tag → it appears as a pill
  const name = `E2E Tag ${Date.now() % 100000}`;
  await page.getByLabel("New tag").fill(name);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(name)).toBeVisible();

  // add a custom field on assets (unique label so it doesn't collide with prior runs in the dev DB)
  const stamp = Date.now() % 100000;
  await page.getByLabel("Key").fill(`e2e_field_${stamp}`);
  await page.getByLabel("Label").fill(`E2E Field ${stamp}`);
  await page.getByLabel("Type", { exact: true }).selectOption("number");
  await page.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByTestId("field-row").filter({ hasText: `E2E Field ${stamp}` })).toBeVisible();
});

// Customization is in the nav for the principal (custom_field read).
test("Customization appears in the nav for the principal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Customization" })).toBeVisible();
});

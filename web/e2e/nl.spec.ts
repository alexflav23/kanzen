import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F32 ⌘K "Ask" vs the REAL backend (Principal session). The model only
// turns the prompt into a structured read-only intent; execution is permission-filtered server-side.
test("⌘K Ask: a natural-language question returns a grounded answer", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Meta+k");
  if (!(await page.getByTestId("command-palette").isVisible().catch(() => false))) await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();

  // a registry-depth question
  await page.getByLabel("Search", { exact: true }).fill("how many watches do I have");
  await page.getByTestId("cmdk-ask").click();
  await expect(page.getByTestId("nl-answer")).toBeVisible();
  await expect(page.getByTestId("nl-answer")).toContainText("registry"); // "N watch(s) in the registry."

  // a finance question via Enter
  await page.getByLabel("Search", { exact: true }).fill("how much did I spend this year");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByTestId("nl-answer")).toContainText("£"); // GBP total

  // NL-2 RAG fallback: an open-ended question with no structured intent → answered from the indexed asset doc
  await page.getByLabel("Search", { exact: true }).fill("tell me about the Royal Oak");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByTestId("nl-answer")).toContainText("Royal Oak");

  // NL-2b crisp single-fact intents — the three named questions, answered against real seed data
  await page.getByLabel("Search", { exact: true }).fill("when is my car next due a service");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByTestId("nl-answer")).toContainText("service");

  await page.getByLabel("Search", { exact: true }).fill("how much is my car insurance");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByTestId("nl-answer")).toContainText("insured");

  await page.getByLabel("Search", { exact: true }).fill("when was the housekeeper last in");
  await page.getByLabel("Search", { exact: true }).press("Enter");
  await expect(page.getByTestId("nl-answer")).toContainText("Housekeeping");
});

import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the People directory vs the REAL backend (seeded team).
test("people page lists the team with roles + flags expiring permits/reviews", async ({ page }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  // scope to the page content — the nav's admin impersonation switcher also lists persona names
  const main = page.getByRole("main");
  // names + chips appear in both the attention strip and the roster → first()
  await expect(main.getByText("Lorna").first()).toBeVisible();
  await expect(main.getByText("Siti").first()).toBeVisible();
  await expect(main.getByText("Needs attention")).toBeVisible();
  await expect(main.getByText(/Permit · \d+d/).first()).toBeVisible(); // Siti's permit
  await expect(main.getByText(/Review · \d+d/).first()).toBeVisible(); // Lorna/Marcia reviews
});

test("opening a person shows their HR record (contract, permit, emergency contact)", async ({ page }) => {
  await page.goto("/people");
  await page.getByRole("link", { name: "Open Siti's record" }).click();
  await expect(page.getByTestId("person-name")).toHaveText("Siti");
  await expect(page.getByText("Full-time")).toBeVisible(); // contract
  await expect(page.getByText("S1234567X")).toBeVisible(); // work permit no.
  await expect(page.getByTestId("emergency-contact")).toContainText("Ahmad Rahmat");
  await expect(page.getByText("HR documents")).toBeVisible(); // documents section (card title)
});

test("a team member can be added (Manager+)", async ({ page }) => {
  const name = `Tomas ${Date.now()}`;
  await page.goto("/people");
  await page.getByRole("button", { name: "Add person" }).click();
  const modal = page.getByTestId("add-person");
  await modal.getByLabel("Name").fill(name);
  await modal.getByLabel("Role").fill("Chauffeur");
  await modal.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("main").getByText(name)).toBeVisible();
});

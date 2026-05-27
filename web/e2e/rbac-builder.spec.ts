import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

// F02 v2 — the enterprise RBAC builder (Settings → Builder). Default Flavian/principal (admin) session.
// Creates a throwaway permission set, toggles a grant, previews a user's effective permissions, then cleans up.
// Screenshots both themes + an axe sweep (light + dark) for the a11y leg of the slice gate.

test("the builder composes a permission set, toggles a grant, and previews effective permissions", async ({ page }) => {
  page.on("dialog", (d) => d.accept()); // accept delete-confirm
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();

  // Builder is the default mode; its four tabs are present.
  for (const t of ["Permission sets", "Roles", "Teams", "People"]) {
    await expect(page.getByRole("tab", { name: t })).toBeVisible();
  }

  // ── Permission sets: create one, grant an action ──
  const name = `E2E Set ${Date.now()}`;
  await page.getByLabel("New permission set").fill(name);
  await page.getByRole("button", { name: "Add set", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // expand the bill resource group and Allow bill:approve
  await page.getByRole("button", { name: /^bill\b/ }).click();
  const approve = page.getByRole("group", { name: "bill:approve effect" });
  await approve.getByRole("button", { name: "Allow" }).click();
  await expect(approve.getByRole("button", { name: "Allow" })).toHaveAttribute("aria-pressed", "true");
  // the scope selector appears for an allowed action
  await expect(page.getByLabel("Scope for bill:approve")).toBeVisible();

  await page.screenshot({ path: "e2e/.artifacts/rbac-builder-light.png", fullPage: true });

  // ── dark theme ──
  await page.keyboard.press("Meta+d");
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "e2e/.artifacts/rbac-builder-dark.png", fullPage: true });
  await page.keyboard.press("Meta+d"); // back to light

  // ── People: effective-permissions preview renders ──
  await page.getByRole("tab", { name: "People" }).click();
  await expect(page.getByText(/actions allowed/)).toBeVisible();

  // ── cleanup: delete the set ── (switching tabs unmounts the panel, so re-select it in the sidebar)
  await page.getByRole("tab", { name: "Permission sets" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Delete set" }).click();
  await expect(page.getByText(name)).toHaveCount(0);
});

test("a11y: the RBAC builder is free of serious/critical violations (light + dark)", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("tab", { name: "Permission sets" })).toBeVisible();

  const scan = async () => {
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude('[data-testid="kanzen-loader"]')
      .analyze();
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  };

  expect(await scan()).toEqual([]);
  await page.keyboard.press("Meta+d");
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "dark");
  expect(await scan()).toEqual([]);
});

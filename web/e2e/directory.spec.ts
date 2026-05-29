import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Directory (operational mailboxes + role/property addresses).
test("directory shows operational mailboxes and role addresses", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible();
  await expect(page.getByText("deliveries@kanzen.family")).toBeVisible(); // operational mailbox
  await expect(page.getByText("flavian@kanzen.family")).toBeVisible(); // role address
  expect(await page.getByTestId("dir-address").count()).toBe(9); // 5 mailboxes + 4 role/property
});

test("Directory is reachable from the left nav", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Directory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible();
});

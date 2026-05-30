import { test, expect } from "@playwright/test";

// F48 — the realtime socket→UI path, proven in a real browser against the live backend.
// The inbox opens a CollabPanel on a thread; a comment posted out-of-band (a *different* client) must appear in the
// open panel with no manual refresh — i.e. it arrived over the websocket, not a poll.
const OCADO = "49100000-0000-0000-0000-000000000001";

async function devToken(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const res = await request.post("http://localhost:8080/api/dev/token", {
    data: { email: "flavian@kanzen.local", role: "principal" },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { token: string }).token;
}

test("the app opens a websocket to /api/ws", async ({ page }) => {
  // ignore Vite's HMR socket — wait specifically for our realtime socket
  const wsPromise = page.waitForEvent("websocket", {
    predicate: (ws) => ws.url().includes("/api/ws"),
    timeout: 10_000,
  });
  await page.goto(`/inbox?thread=${OCADO}`);
  const ws = await wsPromise;
  expect(ws.url()).toContain("/api/ws");
});

test("a comment from another client lands in the open panel without a refresh", async ({ page, request }) => {
  await page.goto(`/inbox?thread=${OCADO}`);
  // the CollabPanel ("Internal notes") is present for the open thread
  await expect(page.getByText("Internal notes")).toBeVisible({ timeout: 10_000 });

  const marker = `rt-e2e ${Date.now()}`;
  const token = await devToken(request);
  // post as a separate client (REST), the way a teammate's browser would have
  const res = await request.post("http://localhost:8080/api/comments", {
    headers: { Authorization: `Bearer ${token}` },
    data: { entityType: "email_thread", entityId: OCADO, body: marker },
  });
  expect(res.ok()).toBeTruthy();

  // it must surface in THIS page driven only by the realtime push (no reload)
  await expect(page.getByText(marker)).toBeVisible({ timeout: 8_000 });
});

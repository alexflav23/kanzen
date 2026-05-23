import { test as base, expect } from "@playwright/test";

/**
 * Shared Playwright fixture. Every test built on this `test` automatically
 * fails if the browser logs a console error, throws an uncaught exception, or
 * a request fails — the same red flags you'd watch in DevTools. Listeners are
 * attached before the test body runs (auto fixture), so nothing is missed.
 */
const IGNORE = [/favicon\.ico/];

export const test = base.extend<{ errorGuard: void }>({
  errorGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) errors.push(`console.error: ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("requestfailed", (r) => {
        if (!IGNORE.some((rx) => rx.test(r.url()))) errors.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 500 && !IGNORE.some((rx) => rx.test(r.url()))) errors.push(`http.${r.status()}: ${r.url()}`);
      });
      await use();
      expect(errors, `Browser surfaced ${errors.length} error(s):\n${errors.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

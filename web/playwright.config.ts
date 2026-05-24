import { defineConfig, devices } from "@playwright/test";

// Playwright drives the real Vite dev server (StyleX runtime-injected).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: { baseURL: "http://localhost:3020", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    port: 3020,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

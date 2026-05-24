import { defineConfig, devices } from "@playwright/test";

// Playwright drives the real Vite dev server against the real backend API (:8080).
// A `setup` project signs in (dev token → storageState); every test runs authenticated.
// CI must have the backend + seeded Postgres up before the web e2e job (see .gitlab-ci.yml).
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
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/principal.json" },
      dependencies: ["setup"],
    },
  ],
});

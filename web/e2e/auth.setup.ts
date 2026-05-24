import { test as setup } from "@playwright/test";
import fs from "node:fs";

// Sign in for real: mint a Principal token from the backend's dev endpoint and persist
// it as Playwright storageState, so the authenticated shell renders in every test.
// Requires the backend (:8080, env=local) + seeded Postgres to be running.
const authFile = "e2e/.auth/principal.json";

setup("authenticate as Toby (Principal)", async ({ request }) => {
  const res = await request.post("http://localhost:8080/api/dev/token", {
    data: { email: "toby@kanzen.local", role: "principal" },
  });
  if (!res.ok()) throw new Error(`dev token mint failed (${res.status()}) — is the backend running?`);
  const { token } = (await res.json()) as { token: string };

  const state = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:3020",
        localStorage: [
          { name: "kanzen.token", value: token },
          { name: "kanzen.persona", value: JSON.stringify({ name: "Toby", email: "toby@kanzen.local", role: "principal" }) },
        ],
      },
    ],
  };
  fs.mkdirSync("e2e/.auth", { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(state));
});

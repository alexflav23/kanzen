/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// StyleX via the React Babel transform (Hyperstore pattern): dev + runtimeInjection
// so styles work in dev, Vitest (jsdom) and Playwright without a separate build step.
const stylexBabel = [
  "@stylexjs/babel-plugin",
  {
    dev: true,
    runtimeInjection: true,
    genConditionalClasses: true,
    treeshakeCompensation: true,
    unstable_moduleResolution: { type: "commonJS", rootDir: process.cwd() },
  },
];

export default defineConfig({
  plugins: [react({ babel: { plugins: [stylexBabel] } })],
  server: { port: 3001 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

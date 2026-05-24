/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// StyleX: the React Babel transform compiles stylex.create/props to atomic class
// names with NO runtime injection (runtimeInjection:false). The real CSS is
// extracted by @stylexjs/postcss-plugin (postcss.config.cjs) into the `@stylex;`
// directive in src/stylex.css — for both dev and the production build.
export default defineConfig(({ command }) => {
  const isDev = command !== "build";
  const stylexBabel = [
    "@stylexjs/babel-plugin",
    {
      dev: isDev,
      runtimeInjection: false,
      genConditionalClasses: true,
      treeshakeCompensation: true,
      unstable_moduleResolution: { type: "commonJS", rootDir: process.cwd() },
    },
  ];

  // Local hostnames allowed to reach the dev/preview server (kanzen.local needs
  // a matching /etc/hosts entry: `127.0.0.1 kanzen.local`).
  const allowedHosts = ["kanzen.local", "localhost"];

  return {
    plugins: [react({ babel: { plugins: [stylexBabel] } })],
    server: { port: 3020, allowedHosts },
    preview: { port: 3020, allowedHosts },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});

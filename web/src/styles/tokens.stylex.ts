import * as stylex from "@stylexjs/stylex";

// F00 design tokens — the variable *contract*. Default values are the
// warm-paper LIGHT theme (SPEC §16); the dark theme overrides them via
// createTheme (src/styles/themes/dark.stylex.ts). Every surface/ink/accent in
// the app references these, so theming is a single switch.
export const colors = stylex.defineVars({
  bg: "#faf8f5",
  bgElev: "#ffffff",
  bgSunken: "#f2efe9",
  ink: "#1a1a1a",
  ink2: "#3a3a3a",
  ink3: "#6b6b6b",
  line: "#e7e3dc",
  accent: "#4f46e5",
  accentSoft: "#eef2ff",
  accentInk: "#ffffff",
  positive: "#15803d",
  warn: "#b45309",
  warnSoft: "#fff7ed",
  danger: "#b91c1c",
  dangerSoft: "#fdecec",
});

export const radius = stylex.defineVars({
  sm: "6px",
  md: "10px",
  lg: "14px",
});

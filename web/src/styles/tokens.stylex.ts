import * as stylex from "@stylexjs/stylex";

// F00 design tokens — warm-paper light theme, single indigo accent (SPEC §16),
// ported from the prototype's CSS variables. Dark theme via createTheme later.
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
});

export const radius = stylex.defineVars({
  sm: "6px",
  md: "10px",
  lg: "14px",
});

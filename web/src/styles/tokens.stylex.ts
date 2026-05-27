import * as stylex from "@stylexjs/stylex";

// F00 design tokens — the variable *contract*, matched 1:1 to the design system
// (`input/styles.css` from Claude Design). Default values = the warm-paper LIGHT
// theme; the dark theme overrides them via createTheme (src/styles/themes/dark.stylex.ts).
// Every surface/ink/accent references these, so theming is a single switch.
export const colors = stylex.defineVars({
  bg: "#F7F6F2",
  bgElev: "#FFFFFF",
  bgSunken: "#F1EFE9",
  bgOverlay: "rgba(247, 246, 242, .72)", // sticky topbar (blurred)
  line: "rgba(10, 11, 15, .07)",
  lineStrong: "rgba(10, 11, 15, .14)",
  ink: "#0A0B0F",
  ink2: "#2B2C31",
  ink3: "#5F6168",
  ink4: "#8C8E96",
  ink5: "#B3B5BB",
  accent: "#4F46E5",
  accentSoft: "rgba(79, 70, 229, .10)",
  accentInk: "#FFFFFF",
  positive: "#15803D",
  positiveSoft: "rgba(21, 128, 61, .10)",
  warn: "#92400E", // one shade darker than the design's #B45309 so warn-on-warnSoft clears WCAG AA (4.5:1)
  warnSoft: "rgba(180, 83, 9, .12)",
  danger: "#B91C1C",
  dangerSoft: "rgba(185, 28, 28, .10)",
  scrim: "rgba(10, 11, 15, .32)",
  // elevation — themed in the SAME group so dark is a single global override (no second theme class)
  shadow1: "0 1px 0 rgba(10,11,15,.04), 0 1px 2px rgba(10,11,15,.04)",
  shadow2: "0 1px 0 rgba(10,11,15,.04), 0 8px 24px -8px rgba(10,11,15,.10)",
  shadowPop: "0 12px 40px -8px rgba(10,11,15,.18), 0 2px 6px rgba(10,11,15,.06)",
});

// Radii are theme-independent, so they're a separate (non-themed) group.
export const radius = stylex.defineVars({
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  xxl: "28px",
  pill: "999px",
});

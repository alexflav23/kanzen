import * as stylex from "@stylexjs/stylex";
import { colors } from "../tokens.stylex";

// Cool near-black dark theme — matched 1:1 to the design system's
// `:root[data-theme="dark"]` (input/styles.css). Applied as a class on the app
// root via createTheme; overrides every token within that subtree.
export const darkTheme = stylex.createTheme(colors, {
  bg: "#0A0B10",
  bgElev: "#1B1E27",
  bgSunken: "#06070C",
  bgOverlay: "rgba(11, 12, 18, .76)",
  line: "rgba(255, 255, 255, .085)",
  lineStrong: "rgba(255, 255, 255, .18)",
  ink: "#F8F7F4",
  ink2: "#E6E4DF",
  ink3: "#BFC1C8",
  ink4: "#8E919A",
  ink5: "#585B64",
  accent: "#8B85FF",
  accentSoft: "rgba(139, 133, 255, .12)", // .12 not the design's .18 → accent-on-accentSoft pills clear WCAG AA in dark
  accentInk: "#0A0B0F",
  positive: "#5EE39A",
  positiveSoft: "rgba(94, 227, 154, .14)",
  warn: "#FBBF24",
  warnSoft: "rgba(251, 191, 36, .16)",
  danger: "#FB7185",
  dangerSoft: "rgba(251, 113, 133, .14)",
  info: "#38BDF8",
  infoSoft: "rgba(56, 189, 248, .16)",
  violet: "#C4B5FD",
  violetSoft: "rgba(196, 181, 253, .16)",
  scrim: "rgba(0, 0, 0, .56)",
  shadow1: "0 1px 0 rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3)",
  shadow2: "0 1px 0 rgba(0,0,0,.4), 0 8px 24px -8px rgba(0,0,0,.6)",
  shadowPop: "0 24px 60px -8px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.4)",
});

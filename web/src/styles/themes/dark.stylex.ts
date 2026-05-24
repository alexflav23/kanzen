import * as stylex from "@stylexjs/stylex";
import { colors } from "../tokens.stylex";

// Warm-dark theme (the prototype's ⌘D variant). Applied as a class on the app
// root via createTheme — overrides every color token within that subtree.
// Surface order inverts: bgElev (lightest) > bg > bgSunken (darkest).
export const darkTheme = stylex.createTheme(colors, {
  bg: "#15140f",
  bgElev: "#1e1c16",
  bgSunken: "#100f0b",
  ink: "#f4f1ea",
  ink2: "#cac5bb",
  ink3: "#8f897e",
  line: "#2f2b24",
  accent: "#7c7bf5",
  accentSoft: "#211f3d",
  accentInk: "#ffffff",
  positive: "#4ade80",
  warn: "#fbbf24",
  warnSoft: "#2a2113",
  danger: "#f87171",
  dangerSoft: "#3a1c1c",
});

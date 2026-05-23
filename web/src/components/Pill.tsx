import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "../styles/tokens.stylex";

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 10px",
    borderRadius: radius.sm,
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: colors.bgSunken,
    color: colors.ink2,
  },
  accent: { backgroundColor: colors.accentSoft, color: colors.accent },
  warn: { backgroundColor: colors.warnSoft, color: colors.warn },
});

export type PillTone = "default" | "accent" | "warn";

/** F00 design-system component — token-driven pill (SPEC §16 / App. E). */
export function Pill({ tone = "default", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      {...stylex.props(styles.base, tone === "accent" && styles.accent, tone === "warn" && styles.warn)}
    >
      {children}
    </span>
  );
}

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "../styles/tokens.stylex";

// The agent ribbon — shown wherever the email agent acted (SPEC §16).
const styles = stylex.create({
  ribbon: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 8px",
    borderRadius: radius.sm,
    fontSize: "11.5px",
    fontWeight: 600,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  glyph: { width: "6px", height: "6px", borderRadius: "999px", backgroundColor: colors.accent },
});

export function AgentRibbon({ children }: { children?: ReactNode }) {
  return (
    <span {...stylex.props(styles.ribbon)}>
      <span {...stylex.props(styles.glyph)} />
      {children ?? "Agent"}
    </span>
  );
}

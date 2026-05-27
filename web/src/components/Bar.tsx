import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";

const styles = stylex.create({
  track: { height: "6px", borderRadius: "999px", backgroundColor: colors.bgSunken, overflow: "hidden" },
  fill: (pct: number) => ({ height: "100%", borderRadius: "999px", backgroundColor: colors.accent, width: `${pct}%` }),
});

/** Horizontal progress bar (budget spent vs budget). */
export function Bar({ pct }: { pct: number }) {
  return (
    <div {...stylex.props(styles.track)}>
      <div {...stylex.props(styles.fill(Math.min(100, Math.max(0, pct))))} />
    </div>
  );
}

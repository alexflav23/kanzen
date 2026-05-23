import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";

const styles = stylex.create({
  track: { height: "6px", borderRadius: "999px", backgroundColor: colors.bgSunken, overflow: "hidden" },
  fill: { height: "100%", borderRadius: "999px", backgroundColor: colors.accent },
});

/** Horizontal progress bar (budget spent vs budget). */
export function Bar({ pct }: { pct: number }) {
  return (
    <div {...stylex.props(styles.track)}>
      <div {...stylex.props(styles.fill)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

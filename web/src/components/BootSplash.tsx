import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { colors } from "../styles/tokens.stylex";
import { KanzenLoader } from "./KanzenLoader";

// Cold-load splash: the 完 mark fills on the warm-paper background, then fades into the shell.
// Themed (bg + accent adapt to light/dark). pointer-events:none so it never blocks interaction.
const styles = stylex.create({
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    backgroundColor: colors.bg,
    pointerEvents: "none",
    opacity: 1,
    transitionProperty: "opacity",
    transitionDuration: "0.4s",
    transitionTimingFunction: "cubic-bezier(.2,.7,.2,1)",
  },
  fade: { opacity: 0 },
  stack: { display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" },
  wordmark: { fontSize: "15px", fontWeight: 600, letterSpacing: "0.02em", color: colors.ink3 },
});

// Skip the cosmetic splash under test automation (Playwright sets navigator.webdriver) so it
// never shifts timing or overlays content during the e2e suite. Real users always see it.
const isAutomated = typeof navigator !== "undefined" && navigator.webdriver;

export function BootSplash() {
  const [phase, setPhase] = useState<"show" | "fade">("show");
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const fade = setTimeout(() => setPhase("fade"), 900);
    const done = setTimeout(() => setGone(true), 1350);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, []);
  if (isAutomated || gone) return null;
  return (
    <div {...stylex.props(styles.overlay, phase === "fade" && styles.fade)} aria-hidden="true" data-testid="boot-splash">
      <div {...stylex.props(styles.stack)}>
        <KanzenLoader size={104} />
        <div {...stylex.props(styles.wordmark)}>Kanzen</div>
      </div>
    </div>
  );
}

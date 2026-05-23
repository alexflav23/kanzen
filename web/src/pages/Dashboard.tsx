import * as stylex from "@stylexjs/stylex";
import { Pill } from "../components/Pill";

const styles = stylex.create({
  topbar: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "20px" },
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "8px" },
});

export function Dashboard() {
  return (
    <div>
      <div {...stylex.props(styles.topbar)}>
        <Pill tone="accent">Foundation</Pill>
        <Pill>F00 · design system</Pill>
      </div>
      <h1 {...stylex.props(styles.title)}>Good morning.</h1>
      <p>Kanzen web shell — the StyleX design system + grouped navigation.</p>
    </div>
  );
}

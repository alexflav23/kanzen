import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "../components/Pill";
import { PEOPLE } from "../data/mockPeople";

const styles = stylex.create({
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "16px" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", border: `1px solid ${colors.line}`, borderRadius: radius.md, backgroundColor: colors.bgElev, marginBottom: "8px" },
  avatar: { width: "32px", height: "32px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, display: "grid", placeItems: "center", fontWeight: 600, fontSize: "13px" },
  name: { fontWeight: 500 },
  role: { color: colors.ink3, fontSize: "13px" },
  grow: { flex: 1 },
});

export function People() {
  return (
    <div>
      <h1 {...stylex.props(styles.title)}>People</h1>
      {PEOPLE.map((p) => (
        <div key={p.id} data-testid="person-row" {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.avatar)}>{p.name[0]}</span>
          <div {...stylex.props(styles.grow)}>
            <div {...stylex.props(styles.name)}>{p.name}</div>
            <div {...stylex.props(styles.role)}>{p.role}</div>
          </div>
          {p.permitDays != null && p.permitDays < 90 && <Pill tone="warn">Work permit · {p.permitDays}d</Pill>}
        </div>
      ))}
    </div>
  );
}

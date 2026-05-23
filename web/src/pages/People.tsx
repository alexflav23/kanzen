import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { ChevronRight, Alert } from "../components/icons";
import { PEOPLE } from "../data/mockPeople";

const styles = stylex.create({
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink, marginBottom: "24px" },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, display: "grid", placeItems: "center", fontWeight: 600, fontSize: "14px" },
  name: { fontWeight: 500 },
  role: { color: colors.ink3, fontSize: "13px" },
  grow: { flex: 1 },
});

export function People() {
  return (
    <div>
      <div {...stylex.props(styles.eyebrow)}>HR</div>
      <h1 {...stylex.props(styles.title)}>People</h1>
      <Card>
        <CardHeader><CardTitle>Household team · {PEOPLE.length}</CardTitle></CardHeader>
        {PEOPLE.map((p) => (
          <CardRow key={p.id}>
            <span {...stylex.props(styles.avatar)} data-testid="person-row">{p.name[0]}</span>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.name)}>{p.name}</div>
              <div {...stylex.props(styles.role)}>{p.role}</div>
            </div>
            {p.permitDays != null && p.permitDays < 90 && (
              <Pill tone="warn"><Alert size={11} /> Work permit · {p.permitDays}d</Pill>
            )}
            <ChevronRight size={14} />
          </CardRow>
        ))}
      </Card>
    </div>
  );
}

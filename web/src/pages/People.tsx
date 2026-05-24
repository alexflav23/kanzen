import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Alert } from "../components/icons";
import { daysUntil, listPeople } from "../services/people";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink, marginBottom: "24px" },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, display: "grid", placeItems: "center", fontWeight: 600, fontSize: "14px" },
  name: { fontWeight: 500 },
  role: { color: colors.ink3, fontSize: "13px" },
  grow: { flex: 1 },
});

export function People() {
  const { token } = useAuth();
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });

  return (
    <div>
      <div {...stylex.props(styles.eyebrow)}>HR</div>
      <h1 {...stylex.props(styles.title)}>People</h1>
      {peopleQ.isPending ? <Loading label="Loading the team…" />
        : peopleQ.isError ? <ErrorState error={peopleQ.error} />
        : peopleQ.data.length === 0 ? <EmptyState title="No people yet">Add household team members to track HR and permits.</EmptyState>
        : (
          <Card>
            <CardHeader><CardTitle>Household team · {peopleQ.data.length}</CardTitle></CardHeader>
            {peopleQ.data.map((p) => {
              const days = daysUntil(p.permitExpiry);
              return (
                <CardRow key={p.id}>
                  <span {...stylex.props(styles.avatar)} data-testid="person-row">{p.name[0]}</span>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.name)}>{p.name}</div>
                    <div {...stylex.props(styles.role)}>{p.role ?? "—"}</div>
                  </div>
                  {days != null && days < 90 && (
                    <Pill tone={days < 0 ? "danger" : "warn"}>
                      <Alert size={11} /> Work permit · {days < 0 ? "expired" : `${days}d`}
                    </Pill>
                  )}
                </CardRow>
              );
            })}
          </Card>
        )}
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Check, X } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { confirmAction, getInbox, listActions, rejectAction } from "../services/inbox";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  glance: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "20px" },
  stat: { padding: "16px 18px", borderRadius: radius.lg, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev },
  statN: { fontSize: "28px", fontWeight: 700, color: colors.ink, fontVariantNumeric: "tabular-nums" },
  statL: { fontSize: "12px", color: colors.ink3, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  grow: { flex: 1, minWidth: 0 },
  subj: { fontSize: "14px", fontWeight: 500, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  actions: { display: "flex", gap: "8px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  approve: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
});

const human = (a: string) => a.replace(/_/g, " ");

/** F26 — unified Inbox + Triage. Counts across review streams + the agent's proposed actions;
  * financial/asset proposals are flagged "Review" (never auto-committed, F27). */
export function Inbox() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const inbox = useQuery({ queryKey: ["inbox", token], queryFn: () => getInbox(token) });
  const actions = useQuery({ queryKey: ["agent-actions", "proposed", token], queryFn: () => listActions(token, "proposed") });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["agent-actions"] }); qc.invalidateQueries({ queryKey: ["inbox"] }); };
  const confirm = useMutation({ mutationFn: (id: string) => confirmAction(id, token), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (id: string) => rejectAction(id, token), onSuccess: invalidate });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Inbox · Triage</div>
        <h1 {...stylex.props(styles.title)}>Inbox</h1>
        <div {...stylex.props(styles.desc)}>What needs a decision. The agent proposes; you confirm. Financial and asset items are never committed without your review.</div>
      </header>

      {inbox.isPending ? <Loading /> : inbox.isError ? <ErrorState error={inbox.error} /> : (
        <div {...stylex.props(styles.glance)} data-testid="inbox-glance">
          <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statN)} data-testid="count-agent">{inbox.data.counts.agent ?? 0}</div><div {...stylex.props(styles.statL)}>Agent proposals</div></div>
          <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statN)} data-testid="count-recon">{inbox.data.counts.reconciliation ?? 0}</div><div {...stylex.props(styles.statL)}>To reconcile</div></div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Triage · {actions.data?.length ?? 0}</CardTitle></CardHeader>
        {actions.isPending ? <Loading /> : actions.isError ? <ErrorState error={actions.error} />
          : actions.data.length === 0 ? <EmptyState title="All clear">Nothing awaiting triage.</EmptyState>
          : actions.data.map((a) => (
            <div key={a.id} {...stylex.props(styles.row)} data-testid="triage-row">
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.subj)}>{a.subject ?? human(a.actionType)}</div>
                <div {...stylex.props(styles.meta)}>{human(a.actionType)}</div>
              </div>
              {a.category && <Pill tone={a.locked ? "warn" : "default"}>{a.category}</Pill>}
              {a.locked && <Pill tone="warn">Review</Pill>}
              <div {...stylex.props(styles.actions)}>
                <button type="button" onClick={() => reject.mutate(a.id)} {...stylex.props(styles.btn)}><X size={14} /> Reject</button>
                <button type="button" onClick={() => confirm.mutate(a.id)} {...stylex.props(styles.btn, styles.approve)}><Check size={14} /> {a.locked ? "Confirm (review)" : "Confirm"}</button>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../../styles/tokens.stylex";
import { Card } from "../../components/Card";
import { Timeline, type TimelineItem, type TimelineTone } from "../../components/Timeline";
import { Loading, ErrorState, EmptyState } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { listAudit, listAuditActions } from "../../services/audit";

/** F19/W2 — the platform action log: every audited write across the platform (who · what · when · to what),
 *  rendered through the reusable <Timeline>. Admin-only (server-gated). Filterable by action. */

// Map an audit action key → a timeline tone (state carried by tone + label, never colour alone).
function toneFor(action: string): TimelineTone {
  if (/(delete|remove|untag|decline|reject)/.test(action)) return "danger";
  if (/(approve|pay|value|valuation|reconcile|restore|complete)/.test(action)) return "positive";
  if (/(move|custody|hero|order|schedule)/.test(action)) return "violet";
  if (/^(permission|role|rbac|impersonate|team|backup|user)/.test(action)) return "muted";
  if (/(create|add|upload|propose|new|\.set)/.test(action)) return "accent";
  return "info";
}

const styles = stylex.create({
  bar: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" },
  label: { fontSize: "12px", color: colors.ink3 },
  select: { padding: "6px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12.5px", cursor: "pointer" },
  count: { fontSize: "12px", color: colors.ink3, marginLeft: "auto" },
});

export function AuditLog() {
  const { token } = useAuth();
  const [action, setAction] = useState("");
  const entries = useQuery({
    queryKey: ["audit", { action }, token],
    queryFn: () => listAudit(token, { limit: 200, action: action || undefined }),
  });
  const actions = useQuery({ queryKey: ["audit-actions", token], queryFn: () => listAuditActions(token) });

  const items: TimelineItem[] = (entries.data ?? []).map((e) => ({
    id: e.id,
    type: e.action,
    at: e.at,
    title: e.action.replace(/[._]/g, " "),
    subtitle: [e.actorName ?? e.actorType, e.targetType].filter(Boolean).join(" · ") || null,
    tone: toneFor(e.action),
  }));

  return (
    <div>
      <div {...stylex.props(styles.bar)}>
        <label {...stylex.props(styles.label)} htmlFor="audit-action">Action</label>
        <select id="audit-action" {...stylex.props(styles.select)} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {(actions.data ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {entries.data && <span {...stylex.props(styles.count)} data-testid="audit-count">{entries.data.length} entries</span>}
      </div>
      <Card>
        {entries.isPending ? <Loading />
          : entries.isError ? <ErrorState error={entries.error} />
          : items.length === 0 ? <EmptyState title="No activity">Nothing matches this filter.</EmptyState>
          : <Timeline items={items} />}
      </Card>
    </div>
  );
}

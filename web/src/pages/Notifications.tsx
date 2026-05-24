import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { getNotifications, markRead } from "../services/notifications";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  unreadDot: { width: "8px", height: "8px", borderRadius: "999px", backgroundColor: colors.accent, flexShrink: 0 },
  readDot: { width: "8px", height: "8px", flexShrink: 0 },
  grow: { flex: 1, minWidth: 0 },
  nTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  nBody: { fontSize: "12.5px", color: colors.ink3, marginTop: "2px" },
  when: { fontSize: "11.5px", color: colors.ink3, whiteSpace: "nowrap" },
  btn: { padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
});

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

/** F34 — the in-app notification centre. Items are fanned out from domain events, honouring
  * F02 at delivery (you only see what you're entitled to). Mark-read is self-scoped. */
export function Notifications() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const inbox = useQuery({ queryKey: ["notifications", token], queryFn: () => getNotifications(token) });
  const read = useMutation({ mutationFn: (id: string) => markRead(id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Notifications</div>
        <h1 {...stylex.props(styles.title)}>Notifications</h1>
        <div {...stylex.props(styles.desc)}>What the household and the agent did — pinged to you, never showing anything you can't see.</div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
          {inbox.data && inbox.data.unread > 0 && <Pill tone="accent">{inbox.data.unread} unread</Pill>}
        </CardHeader>
        {inbox.isPending ? <Loading /> : inbox.isError ? <ErrorState error={inbox.error} />
          : inbox.data.items.length === 0 ? <EmptyState title="All caught up">No notifications.</EmptyState>
          : inbox.data.items.map((n) => (
            <div key={n.id} {...stylex.props(styles.row)} data-testid="notification-row">
              <span {...stylex.props(n.read ? styles.readDot : styles.unreadDot)} role="img" aria-label={n.read ? "read" : "unread"} />
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.nTitle)}>{n.title}</div>
                {n.body && <div {...stylex.props(styles.nBody)}>{n.body}</div>}
              </div>
              {n.channels.includes("push") && <Pill>push</Pill>}
              <span {...stylex.props(styles.when)}>{ago(n.createdAt)}</span>
              {!n.read && <button type="button" {...stylex.props(styles.btn)} onClick={() => read.mutate(n.id)}>Mark read</button>}
            </div>
          ))}
      </Card>
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "./Pill";
import * as I from "./icons";
import { useAuth } from "../state/AuthContext";
import { useRealtime } from "../realtime/RealtimeProvider";
import { getNotifications, markRead } from "../services/notifications";

const styles = stylex.create({
  wrap: { position: "relative", display: "inline-flex" },
  iconBtn: { position: "relative", width: "30px", height: "30px", display: "inline-grid", placeItems: "center", borderRadius: "8px", border: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer" },
  badge: { position: "absolute", top: "-1px", right: "-1px", minWidth: "16px", height: "16px", padding: "0 4px", boxSizing: "border-box", borderRadius: "999px", backgroundColor: colors.accent, color: colors.accentInk, fontSize: "10px", fontWeight: 700, display: "grid", placeItems: "center", lineHeight: 1 },
  backdrop: { position: "fixed", inset: 0, zIndex: 40, border: 0, background: "transparent", cursor: "default" },
  pop: { position: "absolute", top: "38px", right: 0, width: "340px", maxHeight: "440px", overflowY: "auto", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.md, boxShadow: colors.shadow2, zIndex: 50 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${colors.line}`, position: "sticky", top: 0, backgroundColor: colors.bgElev },
  headTitle: { fontSize: "13px", fontWeight: 600, color: colors.ink },
  item: { display: "flex", alignItems: "flex-start", gap: "10px", width: "100%", textAlign: "left", padding: "11px 14px", borderBottom: `1px solid ${colors.line}`, border: 0, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: colors.line, background: "transparent", cursor: "pointer", ":hover": { backgroundColor: colors.bgSunken } },
  dot: { width: "7px", height: "7px", borderRadius: "999px", marginTop: "5px", flexShrink: 0 },
  unreadDot: { backgroundColor: colors.accent },
  readDot: { backgroundColor: "transparent" },
  grow: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  nTitle: { fontSize: "13px", fontWeight: 500, color: colors.ink },
  nBody: { fontSize: "12px", color: colors.ink3, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  when: { fontSize: "11px", color: colors.ink3, whiteSpace: "nowrap", marginTop: "1px" },
  empty: { padding: "22px 14px", fontSize: "13px", color: colors.ink3, textAlign: "center" },
  footer: { display: "block", padding: "10px 14px", textAlign: "center", fontSize: "12.5px", color: colors.accent, textDecoration: "none", position: "sticky", bottom: 0, backgroundColor: colors.bgElev, borderTop: `1px solid ${colors.line}` },
});

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
};

/** F34 — top-bar notifications bell: an unread badge + a popover of recent items (mark-read on click),
 * polled so the badge stays fresh. Shares the ["notifications"] query with the Notifications centre. */
export function NotificationsBell() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const inbox = useQuery({ queryKey: ["notifications", token], queryFn: () => getNotifications(token), refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (id: string) => markRead(id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  // F48 — an @mention or task assignment pings the bell instantly (no 30s wait for the poll).
  useRealtime((ev) => {
    if (ev.eventType === "comment_mentioned" || ev.eventType === "task.assigned") {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const unread = inbox.data?.unread ?? 0;
  const items = (inbox.data?.items ?? []).slice(0, 6);

  return (
    <div {...stylex.props(styles.wrap)}>
      <button type="button" {...stylex.props(styles.iconBtn)} data-testid="notif-bell"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <I.Bell size={16} />
        {unread > 0 && <span {...stylex.props(styles.badge)} data-testid="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <button type="button" {...stylex.props(styles.backdrop)} aria-label="Close notifications" onClick={() => setOpen(false)} />
          <div {...stylex.props(styles.pop)} role="dialog" aria-label="Notifications" data-testid="notif-popover">
            <div {...stylex.props(styles.head)}>
              <span {...stylex.props(styles.headTitle)}>Notifications</span>
              {unread > 0 && <Pill tone="accent">{unread} unread</Pill>}
            </div>
            {items.length === 0 ? (
              <div {...stylex.props(styles.empty)}>All caught up.</div>
            ) : (
              items.map((n) => (
                <button key={n.id} type="button" {...stylex.props(styles.item)} data-testid="notif-item"
                  onClick={() => { if (!n.read) read.mutate(n.id); }}>
                  <span {...stylex.props(styles.dot, n.read ? styles.readDot : styles.unreadDot)} aria-hidden="true" />
                  <span {...stylex.props(styles.grow)}>
                    <span {...stylex.props(styles.nTitle)}>{n.title}</span>
                    {n.body && <span {...stylex.props(styles.nBody)}>{n.body}</span>}
                  </span>
                  <span {...stylex.props(styles.when)}>{ago(n.createdAt)}</span>
                </button>
              ))
            )}
            <Link to="/notifications" {...stylex.props(styles.footer)} onClick={() => setOpen(false)}>View all →</Link>
          </div>
        </>
      )}
    </div>
  );
}

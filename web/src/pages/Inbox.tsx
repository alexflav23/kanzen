import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "../components/Pill";
import { PersonAvatar } from "../components/PersonAvatar";
import { Avatar } from "../components/Avatar";
import { AgentRibbon } from "../components/AgentRibbon";
import { Check, X, Inbox as InboxIcon } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { confirmAction, rejectAction } from "../services/inbox";
import { listPeople } from "../services/people";
import {
  addThreadComment, assignThread, listInboxes, listThreads, setThreadStatus, threadDetail,
  type CInbox, type CThread,
} from "../services/collabInbox";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
type View = { kind: "all" | "inbox" | "me" | "done"; inboxId?: string };

const styles = stylex.create({
  header: { marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "560px" },
  pane: { display: "grid", gridTemplateColumns: "210px 340px 1fr", border: `1px solid ${colors.line}`, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bgElev, minHeight: "640px", "@media (max-width: 1000px)": { gridTemplateColumns: "1fr" } },
  rail: { borderRight: `1px solid ${colors.line}`, padding: "10px", display: "flex", flexDirection: "column", gap: "1px", backgroundColor: colors.bgSunken },
  railSection: { fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, padding: "12px 10px 4px" },
  railItem: { display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer", padding: "8px 10px", borderRadius: radius.sm, color: colors.ink2, fontSize: "13px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgElev } },
  railItemOn: { backgroundColor: colors.bgElev, color: colors.ink, fontWeight: 500, boxShadow: `inset 2px 0 0 ${colors.accent}` },
  railGrow: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  railCount: { fontSize: "11.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  list: { borderRight: `1px solid ${colors.line}`, overflowY: "auto", maxHeight: "760px" },
  trow: { display: "flex", flexDirection: "column", gap: "3px", width: "100%", textAlign: "left", border: 0, borderBottom: `1px solid ${colors.line}`, background: "transparent", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgSunken } },
  trowOn: { backgroundColor: colors.accentSoft },
  trowTop: { display: "flex", alignItems: "center", gap: "8px" },
  unreadDot: { width: "7px", height: "7px", borderRadius: "999px", backgroundColor: colors.accent, flexShrink: 0 },
  from: { fontSize: "13px", fontWeight: 600, color: colors.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  time: { fontSize: "11px", color: colors.ink3, flexShrink: 0 },
  subj: { fontSize: "13px", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  snip: { fontSize: "12px", color: colors.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  trowMeta: { display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" },
  detail: { display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: "760px" },
  dHead: { display: "flex", alignItems: "flex-start", gap: "12px", padding: "18px 20px", borderBottom: `1px solid ${colors.line}` },
  dSubj: { fontSize: "17px", fontWeight: 600, color: colors.ink },
  dFrom: { fontSize: "12.5px", color: colors.ink3, marginTop: "3px" },
  dActions: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  btn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", fontFamily: "inherit" },
  assignSel: { padding: "6px 8px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12.5px" },
  body: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" },
  prop: { border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, boxShadow: `inset 3px 0 0 ${colors.accent}`, borderRadius: radius.md, padding: "14px 16px" },
  propHead: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  propTitle: { fontSize: "14px", fontWeight: 600, color: colors.ink },
  propSummary: { fontSize: "13px", color: colors.ink2, lineHeight: 1.45 },
  conf: { fontSize: "11px", color: colors.accent, fontWeight: 600, marginLeft: "auto" },
  propActions: { display: "flex", gap: "8px", marginTop: "12px" },
  confirm: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12.5px", fontWeight: 500 },
  reject: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  msg: { borderTop: `1px solid ${colors.line}`, paddingTop: "14px" },
  msgFrom: { fontSize: "12.5px", fontWeight: 500, color: colors.ink },
  msgTime: { fontSize: "11px", color: colors.ink3, marginLeft: "8px" },
  msgBody: { fontSize: "13.5px", color: colors.ink2, lineHeight: 1.55, marginTop: "8px", whiteSpace: "pre-wrap" },
  commentsHead: { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, borderTop: `1px solid ${colors.line}`, paddingTop: "16px" },
  comment: { display: "flex", flexDirection: "column", gap: "2px", padding: "8px 0" },
  cAuthor: { fontSize: "12px", fontWeight: 600, color: colors.ink },
  cBody: { fontSize: "13px", color: colors.ink2 },
  cTime: { fontSize: "11px", color: colors.ink3, marginLeft: "6px" },
  addRow: { display: "flex", gap: "8px", marginTop: "4px" },
  addInput: { flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", boxSizing: "border-box" },
  note: { fontSize: "11.5px", color: colors.ink3, marginTop: "4px" },
  empty: { display: "grid", placeItems: "center", color: colors.ink3, fontSize: "13.5px", padding: "60px 20px" },
});

export function Inbox() {
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "all" });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const canReassign = role != null && role !== "staff";

  const inboxesQ = useQuery({ queryKey: ["inbox-inboxes", token], queryFn: () => listInboxes(token) });
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  const peopleById = useMemo(() => new Map((peopleQ.data ?? []).map((p) => [p.id, p])), [peopleQ.data]);
  const peopleOpts = useMemo(() => (peopleQ.data ?? []).map((p) => ({ id: p.id, name: p.name })), [peopleQ.data]);

  const tq = view.kind === "inbox" ? { inbox: view.inboxId, status: "open" } : view.kind === "me" ? { assignee: "me", status: "open" } : view.kind === "done" ? { status: "done" } : { status: "open" };
  const threadsQ = useQuery({ queryKey: ["inbox-threads", view, token], queryFn: () => listThreads(token, tq) });
  const detailQ = useQuery({ queryKey: ["inbox-thread", selected, token], queryFn: () => threadDetail(selected!, token), enabled: !!selected });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["inbox-threads"] }); qc.invalidateQueries({ queryKey: ["inbox-inboxes"] }); if (selected) qc.invalidateQueries({ queryKey: ["inbox-thread", selected] }); };
  const assign = useMutation({ mutationFn: ({ id, who }: { id: string; who: string | null }) => assignThread(id, who, token), onSuccess: invalidate });
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: string }) => setThreadStatus(id, s, token), onSuccess: () => { setSelected(null); invalidate(); } });
  const comment = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => addThreadComment(id, body, token), onSuccess: () => { setDraft(""); invalidate(); } });
  const confirm = useMutation({ mutationFn: (id: string) => confirmAction(id, token), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (id: string) => rejectAction(id, token), onSuccess: invalidate });

  const threads = threadsQ.data ?? [];
  const railItem = (label: string, on: boolean, onClick: () => void, count?: number) => (
    <button type="button" {...stylex.props(styles.railItem, on && styles.railItemOn)} onClick={onClick} data-testid="inbox-rail-item">
      <span {...stylex.props(styles.railGrow)}>{label}</span>
      {count != null && count > 0 && <span {...stylex.props(styles.railCount)}>{count}</span>}
    </button>
  );

  const detail = detailQ.data;
  const assignee = detail?.thread.assigneeId ? peopleById.get(detail.thread.assigneeId) : undefined;

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Operations · Inbox</div>
        <h1 {...stylex.props(styles.title)}>Inbox</h1>
        <div {...stylex.props(styles.desc)}>Household mail, triaged by the agent into proposed actions — assign a thread, discuss it, turn it into a task, and mark it done.</div>
      </header>

      {inboxesQ.isPending ? <Loading /> : inboxesQ.isError ? <ErrorState error={inboxesQ.error} /> : (
        <div {...stylex.props(styles.pane)} data-testid="inbox-pane">
          <nav {...stylex.props(styles.rail)} aria-label="Inboxes">
            {railItem("All open", view.kind === "all", () => { setSelected(null); setView({ kind: "all" }); })}
            {railItem("Assigned to me", view.kind === "me", () => { setSelected(null); setView({ kind: "me" }); })}
            <div {...stylex.props(styles.railSection)}>Inboxes</div>
            {(inboxesQ.data ?? []).map((i: CInbox) => railItem(i.label, view.kind === "inbox" && view.inboxId === i.id, () => { setSelected(null); setView({ kind: "inbox", inboxId: i.id }); }, i.openCount))}
            <div {...stylex.props(styles.railSection)}>Status</div>
            {railItem("Done", view.kind === "done", () => { setSelected(null); setView({ kind: "done" }); })}
          </nav>

          <div {...stylex.props(styles.list)}>
            {threadsQ.isPending ? <Loading /> : threads.length === 0 ? <EmptyState title="Inbox zero">Nothing here.</EmptyState>
              : threads.map((t: CThread) => (
                <button key={t.id} type="button" {...stylex.props(styles.trow, t.id === selected && styles.trowOn)} data-testid="thread-row" onClick={() => setSelected(t.id)}>
                  <div {...stylex.props(styles.trowTop)}>
                    {t.unread && <span {...stylex.props(styles.unreadDot)} aria-label="unread" />}
                    <span {...stylex.props(styles.from)}>{t.fromName ?? "—"}</span>
                    <span {...stylex.props(styles.time)}>{ago(t.lastMessageAt)}</span>
                  </div>
                  <div {...stylex.props(styles.subj)}>{t.subject}</div>
                  <div {...stylex.props(styles.snip)}>{t.snippet}</div>
                  <div {...stylex.props(styles.trowMeta)}>
                    {t.proposalCount > 0 && <Pill tone="accent">{t.proposalCount} suggested</Pill>}
                    {t.assigneeId && peopleById.get(t.assigneeId) && <Avatar name={peopleById.get(t.assigneeId)!.name} size={20} />}
                  </div>
                </button>
              ))}
          </div>

          {!selected ? <div {...stylex.props(styles.empty)}><InboxIcon size={20} /> Select a thread</div>
            : detailQ.isPending ? <div {...stylex.props(styles.detail)}><Loading /></div>
            : detailQ.isError || !detail ? <div {...stylex.props(styles.detail)}><ErrorState error={detailQ.error} /></div>
            : (
              <div {...stylex.props(styles.detail)} data-testid="thread-detail">
                <div {...stylex.props(styles.dHead)}>
                  <div {...stylex.props(styles.railGrow)}>
                    <div {...stylex.props(styles.dSubj)}>{detail.thread.subject}</div>
                    <div {...stylex.props(styles.dFrom)}>{detail.thread.fromName}</div>
                  </div>
                  <div {...stylex.props(styles.dActions)}>
                    {assignee ? <PersonAvatar person={assignee} canReassign={canReassign} people={peopleOpts} onReassign={(who) => assign.mutate({ id: detail.thread.id, who })} size={26} />
                      : canReassign && (
                        <select {...stylex.props(styles.assignSel)} aria-label="Assign to" value="" onChange={(e) => e.target.value && assign.mutate({ id: detail.thread.id, who: e.target.value })}>
                          <option value="">Assign…</option>
                          {peopleOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    {detail.thread.status !== "done"
                      ? <button type="button" {...stylex.props(styles.btn)} data-testid="thread-done" onClick={() => status.mutate({ id: detail.thread.id, s: "done" })}><Check size={13} /> Done</button>
                      : <button type="button" {...stylex.props(styles.btn)} onClick={() => status.mutate({ id: detail.thread.id, s: "open" })}>Reopen</button>}
                  </div>
                </div>

                <div {...stylex.props(styles.body)}>
                  {detail.proposals.filter((p) => p.status === "proposed").map((p) => (
                    <div key={p.id} {...stylex.props(styles.prop)} data-testid="agent-proposal">
                      <div {...stylex.props(styles.propHead)}>
                        <AgentRibbon>Kanzen</AgentRibbon>
                        <span {...stylex.props(styles.propTitle)}>{p.title}</span>
                        {p.confidence != null && <span {...stylex.props(styles.conf)}>{Math.round(p.confidence * 100)}% sure</span>}
                      </div>
                      <div {...stylex.props(styles.propSummary)}>{p.summary}</div>
                      <div {...stylex.props(styles.propActions)}>
                        <button type="button" {...stylex.props(styles.confirm)} disabled={confirm.isPending} onClick={() => confirm.mutate(p.id)}><Check size={13} /> Confirm</button>
                        <button type="button" {...stylex.props(styles.reject)} onClick={() => reject.mutate(p.id)}><X size={13} /> Dismiss</button>
                      </div>
                    </div>
                  ))}

                  {detail.messages.map((m) => (
                    <div key={m.id} {...stylex.props(styles.msg)}>
                      <span {...stylex.props(styles.msgFrom)}>{m.fromAddr}</span><span {...stylex.props(styles.msgTime)}>{ago(m.sentAt)}</span>
                      <div {...stylex.props(styles.msgBody)}>{m.bodyText}</div>
                    </div>
                  ))}

                  <div {...stylex.props(styles.commentsHead)}>Internal notes</div>
                  {detail.comments.map((c) => (
                    <div key={c.id} {...stylex.props(styles.comment)}>
                      <div><span {...stylex.props(styles.cAuthor)}>{c.authorName ?? "Someone"}</span><span {...stylex.props(styles.cTime)}>{ago(c.createdAt)}</span></div>
                      <div {...stylex.props(styles.cBody)}>{c.body}</div>
                    </div>
                  ))}
                  <div {...stylex.props(styles.addRow)}>
                    <input {...stylex.props(styles.addInput)} aria-label="Add an internal note" placeholder="Add an internal note…" value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) comment.mutate({ id: detail.thread.id, body: draft.trim() }); }} />
                    <button type="button" {...stylex.props(styles.btn)} disabled={!draft.trim() || comment.isPending} onClick={() => comment.mutate({ id: detail.thread.id, body: draft.trim() })}>Note</button>
                  </div>
                  <div {...stylex.props(styles.note)}>Notes stay inside Kanzen — they're never sent to the sender.</div>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

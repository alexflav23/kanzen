import * as stylex from "@stylexjs/stylex";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "../components/Pill";
import { PersonAvatar } from "../components/PersonAvatar";
import { Avatar } from "../components/Avatar";
import { AgentRibbon } from "../components/AgentRibbon";
import { ProposalReviewModal } from "../components/ProposalReviewModal";
import { ReplyComposer } from "../components/ReplyComposer";
import { Check, Inbox as InboxIcon, Documents, Mail, Tasks } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { listPeople } from "../services/people";
import {
  addThreadComment, assignThread, confirmProposal, listInboxes, listThreads, rejectProposal, saveDraft, sendReply, setThreadStatus, threadDetail, threadToTask,
  type CInbox, type CThread,
} from "../services/collabInbox";

const sanitize = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
type Folder = "inbox" | "sent" | "spam" | "archive";
type RailSel = Folder | "mine";
// folders are the left-rail rows; mailboxes are the top tabs. Archived == completed (we archive what we're done with).
const FOLDERS: [Folder, string][] = [["inbox", "Inbox"], ["sent", "Sent"], ["spam", "Spam"], ["archive", "Archived"]];

const styles = stylex.create({
  header: { marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "560px" },
  mailboxTabs: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" },
  mbTab: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 13px", borderRadius: radius.pill, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgSunken } },
  // selected state must outrank :hover (which has higher specificity than a plain class), so repeat the colour here
  mbTabOn: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent, ":hover": { backgroundColor: colors.accent } },
  mbCount: { fontSize: "11px", fontVariantNumeric: "tabular-nums", opacity: 0.85 },
  pane: { display: "grid", gridTemplateColumns: "180px 340px 1fr", border: `1px solid ${colors.line}`, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bgElev, minHeight: "640px", "@media (max-width: 1000px)": { gridTemplateColumns: "1fr" } },
  rail: { borderRight: `1px solid ${colors.line}`, padding: "10px", display: "flex", flexDirection: "column", gap: "1px", backgroundColor: colors.bgSunken },
  railSection: { fontSize: "10.5px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, padding: "12px 10px 4px" },
  railItem: { display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", border: 0, backgroundColor: "transparent", cursor: "pointer", padding: "8px 10px", borderRadius: radius.sm, color: colors.ink2, fontSize: "13px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgElev } },
  railItemOn: { backgroundColor: colors.bgElev, color: colors.ink, fontWeight: 500, boxShadow: `inset 2px 0 0 ${colors.accent}` },
  railGrow: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  railCount: { fontSize: "11.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  listCol: { borderRight: `1px solid ${colors.line}`, display: "flex", flexDirection: "column", overflow: "hidden" },
  folderTabs: { display: "flex", gap: "2px", padding: "8px 10px", borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken },
  folderTab: { flex: 1, padding: "6px 8px", borderRadius: radius.sm, border: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12px", fontWeight: 500, fontFamily: "inherit", ":hover": { backgroundColor: colors.bgElev } },
  folderTabOn: { backgroundColor: colors.bgElev, color: colors.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" },
  list: { overflowY: "auto", maxHeight: "720px" },
  trow: { display: "flex", flexDirection: "column", gap: "3px", width: "100%", textAlign: "left", border: 0, borderBottom: `1px solid ${colors.line}`, backgroundColor: "transparent", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgSunken } },
  trowOn: { backgroundColor: colors.accentSoft, ":hover": { backgroundColor: colors.accentSoft } },
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
  prop: { display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, boxShadow: `inset 3px 0 0 ${colors.accent}`, borderRadius: radius.md, padding: "14px 16px", ":hover": { backgroundColor: colors.bgSunken } },
  propHead: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  propTitle: { fontSize: "14px", fontWeight: 600, color: colors.ink },
  propSummary: { fontSize: "13px", color: colors.ink2, lineHeight: 1.45 },
  conf: { fontSize: "11px", color: colors.accent, fontWeight: 600, marginLeft: "auto" },
  propReview: { fontSize: "12px", fontWeight: 600, color: colors.accent, marginTop: "10px" },
  msg: { borderTop: `1px solid ${colors.line}`, paddingTop: "14px" },
  msgOut: { borderLeft: `2px solid ${colors.accent}`, paddingLeft: "12px", marginLeft: "2px" },
  msgFrom: { fontSize: "12.5px", fontWeight: 500, color: colors.ink },
  msgTime: { fontSize: "11px", color: colors.ink3, marginLeft: "8px" },
  msgVia: { fontSize: "11px", color: colors.accent, marginLeft: "6px", fontWeight: 500 },
  msgBody: { fontSize: "13.5px", color: colors.ink2, lineHeight: 1.55, marginTop: "8px", whiteSpace: "pre-wrap" },
  replyRow: { display: "flex" },
  replyBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgSunken } },
  // internal notes live on the warm "Apple-note" surface — visibly private, distinct from the email body
  notes: { backgroundColor: colors.note, border: `1px solid ${colors.noteLine}`, borderRadius: radius.md, padding: "14px 16px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" },
  notesHead: { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 700, marginBottom: "4px" },
  comment: { display: "flex", flexDirection: "column", gap: "2px", padding: "6px 0" },
  cAuthor: { fontSize: "12px", fontWeight: 600, color: colors.ink },
  cBody: { fontSize: "13px", color: colors.ink2 },
  cTime: { fontSize: "11px", color: colors.ink3, marginLeft: "6px" },
  addRow: { display: "flex", gap: "8px", marginTop: "6px" },
  addInput: { flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.noteLine}`, backgroundColor: colors.bgElev, color: colors.ink, fontSize: "13px", boxSizing: "border-box" },
  noteBtn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: radius.sm, border: `1px solid ${colors.noteLine}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", fontFamily: "inherit" },
  note: { fontSize: "11.5px", color: colors.ink3, marginTop: "6px" },
  empty: { display: "grid", placeItems: "center", color: colors.ink3, fontSize: "13.5px", padding: "60px 20px" },
  attachRow: { display: "flex", flexWrap: "wrap", gap: "8px", borderTop: `1px solid ${colors.line}`, paddingTop: "14px" },
  attach: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: radius.sm, backgroundColor: colors.bgSunken, color: colors.ink2, fontSize: "12px", border: `1px solid ${colors.line}` },
  toast: { position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 80, backgroundColor: colors.ink, color: colors.bgElev, padding: "10px 18px", borderRadius: radius.md, fontSize: "13px", fontWeight: 500, boxShadow: colors.shadowPop },
});

export function Inbox() {
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [mailbox, setMailbox] = useState<string | "all">("all"); // top tab
  const [railSel, setRailSel] = useState<RailSel>("inbox"); // left-rail folder/view
  const [selected, setSelected] = useState<string | null>(params.get("thread"));
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null); // proposal id under review
  const [replying, setReplying] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canReassign = role != null && role !== "staff";

  const inboxesQ = useQuery({ queryKey: ["inbox-inboxes", token], queryFn: () => listInboxes(token) });
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  const peopleById = useMemo(() => new Map((peopleQ.data ?? []).map((p) => [p.id, p])), [peopleQ.data]);
  const peopleOpts = useMemo(() => (peopleQ.data ?? []).map((p) => ({ id: p.id, name: p.name })), [peopleQ.data]);

  const inboxId = mailbox === "all" ? undefined : mailbox;
  const tq = railSel === "mine" ? { inbox: inboxId, folder: "inbox", assignee: "me" } : { inbox: inboxId, folder: railSel };
  const threadsQ = useQuery({ queryKey: ["inbox-threads", mailbox, railSel, token], queryFn: () => listThreads(token, tq) });
  const detailQ = useQuery({ queryKey: ["inbox-thread", selected, token], queryFn: () => threadDetail(selected!, token), enabled: !!selected });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["inbox-threads"] }); qc.invalidateQueries({ queryKey: ["inbox-inboxes"] }); if (selected) qc.invalidateQueries({ queryKey: ["inbox-thread", selected] }); };
  const assign = useMutation({ mutationFn: ({ id, who }: { id: string; who: string | null }) => assignThread(id, who, token), onSuccess: invalidate });
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: string }) => setThreadStatus(id, s, token), onSuccess: () => { setSelected(null); invalidate(); } });
  const comment = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => addThreadComment(id, body, token), onSuccess: () => { setDraft(""); invalidate(); } });
  const confirm = useMutation({
    mutationFn: (id: string) => confirmProposal(id, token),
    onSuccess: (r) => { setReviewing(null); setToast(r.label ?? "Done"); setTimeout(() => setToast(null), 3500); invalidate(); },
  });
  const reject = useMutation({ mutationFn: (id: string) => rejectProposal(id, token), onSuccess: () => { setReviewing(null); invalidate(); } });
  const send = useMutation({
    mutationFn: ({ id, html }: { id: string; html: string }) => sendReply(id, html, token),
    onSuccess: () => { setReplying(false); setToast("Reply sent"); setTimeout(() => setToast(null), 3500); invalidate(); },
  });
  const toTask = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => threadToTask(id, { title, priority: "normal" }, token),
    onSuccess: (r) => { setToast(r.label ?? "Task created"); setTimeout(() => setToast(null), 3500); invalidate(); },
  });
  const autosaveDraft = (id: string, html: string) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { void saveDraft(id, html, token); }, 700);
  };

  const threads = threadsQ.data ?? [];
  const railItem = (label: string, on: boolean, onClick: () => void, testId = "inbox-rail-item") => (
    <button type="button" {...stylex.props(styles.railItem, on && styles.railItemOn)} onClick={onClick} data-testid={testId} aria-current={on ? "true" : undefined}>
      <span {...stylex.props(styles.railGrow)}>{label}</span>
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

      {inboxesQ.isPending ? <Loading /> : inboxesQ.isError ? <ErrorState error={inboxesQ.error} /> : (<>
        <div {...stylex.props(styles.mailboxTabs)} role="tablist" aria-label="Mailboxes">
          <button type="button" role="tab" aria-selected={mailbox === "all"} {...stylex.props(styles.mbTab, mailbox === "all" && styles.mbTabOn)} data-testid="mailbox-all" onClick={() => { setSelected(null); setMailbox("all"); }}>All</button>
          {(inboxesQ.data ?? []).map((i: CInbox) => (
            <button key={i.id} type="button" role="tab" aria-selected={mailbox === i.id} {...stylex.props(styles.mbTab, mailbox === i.id && styles.mbTabOn)} data-testid="mailbox-tab" onClick={() => { setSelected(null); setMailbox(i.id); }}>
              {i.label}{i.openCount > 0 && <span {...stylex.props(styles.mbCount)}>{i.openCount}</span>}
            </button>
          ))}
        </div>

        <div {...stylex.props(styles.pane)} data-testid="inbox-pane">
          <nav {...stylex.props(styles.rail)} aria-label="Folders">
            <div {...stylex.props(styles.railSection)}>Folders</div>
            {FOLDERS.map(([f, label]) => railItem(label, railSel === f, () => { setSelected(null); setRailSel(f); }, `folder-${f}`))}
            <div {...stylex.props(styles.railSection)}>Views</div>
            {railItem("Assigned to me", railSel === "mine", () => { setSelected(null); setRailSel("mine"); }, "view-mine")}
          </nav>

          <div {...stylex.props(styles.listCol)}>
            <div {...stylex.props(styles.list)}>
            {threadsQ.isPending ? <Loading /> : threads.length === 0 ? <EmptyState title={railSel === "inbox" ? "Inbox zero" : railSel === "archive" ? "Nothing archived" : "Nothing here"}>Nothing here.</EmptyState>
              : threads.map((t: CThread) => (
                <button key={t.id} type="button" {...stylex.props(styles.trow, t.id === selected && styles.trowOn)} data-testid="thread-row" onClick={() => { setReplying(false); setSelected(t.id); }}>
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
                    <button type="button" {...stylex.props(styles.btn)} data-testid="thread-to-task" disabled={toTask.isPending} onClick={() => toTask.mutate({ id: detail.thread.id, title: detail.thread.subject ?? "Follow up" })}>
                      <Tasks size={13} /> Task
                    </button>
                    {detail.thread.status === "open" || detail.thread.status === "snoozed"
                      ? <button type="button" {...stylex.props(styles.btn)} data-testid="thread-archive" onClick={() => status.mutate({ id: detail.thread.id, s: "archived" })}><Check size={13} /> Archive</button>
                      : <button type="button" {...stylex.props(styles.btn)} data-testid="thread-reopen" onClick={() => status.mutate({ id: detail.thread.id, s: "open" })}>Reopen</button>}
                  </div>
                </div>

                <div {...stylex.props(styles.body)}>
                  {detail.proposals.filter((p) => p.status === "proposed").map((p) => (
                    <button key={p.id} type="button" {...stylex.props(styles.prop)} data-testid="agent-proposal" onClick={() => setReviewing(p.id)}>
                      <div {...stylex.props(styles.propHead)}>
                        <AgentRibbon>Kanzen</AgentRibbon>
                        <span {...stylex.props(styles.propTitle)}>{p.title}</span>
                        {p.confidence != null && <span {...stylex.props(styles.conf)}>{Math.round(p.confidence * 100)}% sure</span>}
                      </div>
                      <div {...stylex.props(styles.propSummary)}>{p.summary}</div>
                      <div {...stylex.props(styles.propReview)}>Review &amp; confirm →</div>
                    </button>
                  ))}

                  {detail.messages.map((m) => (
                    <div key={m.id} {...stylex.props(styles.msg, m.direction === "outbound" && styles.msgOut)} data-testid={m.direction === "outbound" ? "msg-outbound" : "msg-inbound"}>
                      <span {...stylex.props(styles.msgFrom)}>{m.direction === "outbound" ? "You" : m.fromAddr}</span>
                      <span {...stylex.props(styles.msgTime)}>{ago(m.sentAt)}</span>
                      {m.direction === "outbound" && <span {...stylex.props(styles.msgVia)}>· sent from Kanzen</span>}
                      {m.bodyHtml
                        ? <div {...stylex.props(styles.msgBody)} dangerouslySetInnerHTML={{ __html: sanitize(m.bodyHtml) }} />
                        : <div {...stylex.props(styles.msgBody)}>{m.bodyText}</div>}
                    </div>
                  ))}

                  {detail.attachments.length > 0 && (
                    <div {...stylex.props(styles.attachRow)} data-testid="thread-attachments">
                      {detail.attachments.map((a) => (
                        <span key={a.id} {...stylex.props(styles.attach)} title={a.filename}><Documents size={13} /> {a.filename}</span>
                      ))}
                    </div>
                  )}

                  {replying ? (
                    <ReplyComposer
                      key={detail.thread.id}
                      initialHtml={detail.draft?.bodyHtml ?? ""}
                      sending={send.isPending}
                      onSaveDraft={(html) => autosaveDraft(detail.thread.id, html)}
                      onSend={(html) => send.mutate({ id: detail.thread.id, html })}
                      onCancel={() => setReplying(false)}
                    />
                  ) : (
                    <div {...stylex.props(styles.replyRow)}>
                      <button type="button" {...stylex.props(styles.replyBtn)} data-testid="reply-open" onClick={() => setReplying(true)}>
                        <Mail size={13} /> Reply{detail.draft ? " (draft saved)" : ""}
                      </button>
                    </div>
                  )}

                  <section {...stylex.props(styles.notes)} aria-label="Internal notes" data-testid="internal-notes">
                    <div {...stylex.props(styles.notesHead)}>Internal notes</div>
                    {detail.comments.map((c) => (
                      <div key={c.id} {...stylex.props(styles.comment)}>
                        <div><span {...stylex.props(styles.cAuthor)}>{c.authorName ?? "Someone"}</span><span {...stylex.props(styles.cTime)}>{ago(c.createdAt)}</span></div>
                        <div {...stylex.props(styles.cBody)}>{c.body}</div>
                      </div>
                    ))}
                    <div {...stylex.props(styles.addRow)}>
                      <input {...stylex.props(styles.addInput)} aria-label="Add an internal note" placeholder="Add an internal note…" value={draft} onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) comment.mutate({ id: detail.thread.id, body: draft.trim() }); }} />
                      <button type="button" {...stylex.props(styles.noteBtn)} disabled={!draft.trim() || comment.isPending} onClick={() => comment.mutate({ id: detail.thread.id, body: draft.trim() })}>Note</button>
                    </div>
                    <div {...stylex.props(styles.note)}>Notes stay inside Kanzen — they're never sent to the sender.</div>
                  </section>
                </div>
              </div>
            )}
        </div>
      </>)}
      {reviewing && (
        <ProposalReviewModal
          proposalId={reviewing}
          confirming={confirm.isPending}
          onConfirm={() => confirm.mutate(reviewing)}
          onDismiss={() => reject.mutate(reviewing)}
          onClose={() => setReviewing(null)}
        />
      )}
      {toast && <div {...stylex.props(styles.toast)} role="status" data-testid="inbox-toast">{toast}</div>}
    </div>
  );
}

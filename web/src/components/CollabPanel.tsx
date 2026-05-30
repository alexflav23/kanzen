import * as stylex from "@stylexjs/stylex";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Avatar } from "./Avatar";
import { Check, X } from "./icons";
import { useAuth } from "../state/AuthContext";
import { useRealtime } from "../realtime/RealtimeProvider";
import { addComment, editComment, getComments, type CCollabComment } from "../services/collabInbox";
import { listPeople } from "../services/people";

/** W9.4b-ii — the reusable Collab panel (§11a). Comments + emojis + @mentions + click-to-edit. Mounted on the inbox
 *  thread today; droppable onto any entity (asset, task, property, …) with one line. Internal-only — comment bodies
 *  never leave Kanzen (V2-AC7). */
const EMOJIS = ["😀", "😊", "👍", "🙏", "🎉", "✨", "❤️", "🔥", "✅", "❌", "⚠️", "🥂", "💡", "📌", "📅", "💰", "🏠", "🚗", "🛒", "☕", "📞", "📷", "🙂", "🫡"];

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function CollabPanel({ entityType, entityId, title = "Internal notes", helper }: {
  entityType: string;
  entityId: string;
  title?: string;
  helper?: string;
}) {
  const { token, userId } = useAuth();
  const qc = useQueryClient();
  const commentsQ = useQuery({ queryKey: ["collab-comments", entityType, entityId, token], queryFn: () => getComments(entityType, entityId, token) });
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  // user id → display name (only people who *are* users; you can only mention real users)
  const mentionable = useMemo(
    () => (peopleQ.data ?? []).flatMap((p) => (p.userId ? [{ userId: p.userId, name: p.name, colour: p.colour }] : [])),
    [peopleQ.data],
  );
  const usersById = useMemo(() => new Map(mentionable.map((u) => [u.userId, u.name])), [mentionable]);
  // F47 — userId → identity colour, used to glow the comment author avatar so the eye tracks "who" without reading text
  const coloursByUser = useMemo(() => new Map(mentionable.map((u) => [u.userId, u.colour ?? null])), [mentionable]);

  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionPicker, setMentionPicker] = useState<{ atIdx: number; prefix: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["collab-comments", entityType, entityId] });

  // F48 — someone else's comment/edit on THIS entity lands without a refresh (the realtime push invalidates the query).
  useRealtime((ev) => {
    if (
      (ev.eventType === "comment.created" || ev.eventType === "comment.edited") &&
      ev.subject.type === entityType &&
      ev.subject.id === entityId
    ) {
      invalidate();
    }
  });

  const addM = useMutation({
    mutationFn: () => addComment(entityType, entityId, body.trim(), mentions, token),
    onSuccess: () => { setBody(""); setMentions([]); invalidate(); },
  });
  const editM = useMutation({
    mutationFn: (id: string) => editComment(id, body.trim(), mentions, token),
    onSuccess: () => { setEditingId(null); setBody(""); setMentions([]); invalidate(); },
  });
  const isEdit = editingId != null;
  const submit = () => { if (isEdit) editM.mutate(editingId!); else addM.mutate(); };

  const insertAtCaret = (text: string) => {
    const el = taRef.current;
    if (!el) { setBody(body + text); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const c = start + text.length;
      el.setSelectionRange(c, c);
    });
  };

  // @mention autocomplete — triggered by an @ followed by word chars at the caret
  const onBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setBody(v);
    const caret = e.target.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = /@(\w*)$/.exec(before);
    setMentionPicker(m ? { atIdx: caret - m[0].length, prefix: m[1].toLowerCase() } : null);
  };

  const choosePerson = (p: { userId: string; name: string }) => {
    if (!mentionPicker) return;
    const before = body.slice(0, mentionPicker.atIdx);
    const after = body.slice(mentionPicker.atIdx + 1 + mentionPicker.prefix.length);
    const next = `${before}@${p.name} ${after}`;
    setBody(next);
    setMentions((m) => Array.from(new Set([...m, p.userId])));
    setMentionPicker(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const c = before.length + 1 + p.name.length + 1;
      el.focus();
      el.setSelectionRange(c, c);
    });
  };

  const startEdit = (c: CCollabComment) => {
    setEditingId(c.id);
    setBody(c.body);
    setMentions(c.mentions);
    requestAnimationFrame(() => taRef.current?.focus());
  };
  const cancelEdit = () => { setEditingId(null); setBody(""); setMentions([]); };

  // close emoji picker on Esc / outside click
  useEffect(() => {
    if (!showEmoji && !mentionPicker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowEmoji(false); setMentionPicker(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEmoji, mentionPicker]);

  // render a comment body — @Name segments matching a known mention become chips
  const renderBody = (c: CCollabComment) => {
    const names = c.mentions.map((u) => usersById.get(u)).filter(Boolean) as string[];
    const out: Array<{ kind: "t"; v: string } | { kind: "m"; v: string }> = [];
    let i = 0;
    while (i < c.body.length) {
      const at = c.body.indexOf("@", i);
      if (at < 0) { out.push({ kind: "t", v: c.body.slice(i) }); break; }
      if (at > i) out.push({ kind: "t", v: c.body.slice(i, at) });
      const match = names.find((n) => c.body.slice(at + 1, at + 1 + n.length) === n);
      if (match) { out.push({ kind: "m", v: match }); i = at + 1 + match.length; }
      else { out.push({ kind: "t", v: "@" }); i = at + 1; }
    }
    return out.map((p, k) => p.kind === "m"
      ? <span key={k} {...stylex.props(styles.mention)}>@{p.v}</span>
      : <span key={k}>{p.v}</span>);
  };

  const filtered = mentionPicker
    ? mentionable.filter((m) => m.name.toLowerCase().startsWith(mentionPicker.prefix)).slice(0, 6)
    : [];

  return (
    <section {...stylex.props(styles.surface)} aria-label={title} data-testid="collab-panel">
      <div {...stylex.props(styles.head)}>{title}</div>
      {commentsQ.data?.map((c) => {
        const isMine = c.authorId === userId;
        return (
          <div key={c.id} {...stylex.props(styles.row)} data-testid="collab-comment">
            <Avatar name={c.authorName ?? "Someone"} size={22} colour={coloursByUser.get(c.authorId) ?? null} />
            <div {...stylex.props(styles.rowMain)}>
              <div {...stylex.props(styles.meta)}>
                <span {...stylex.props(styles.author)}>{c.authorName ?? "Someone"}</span>
                <span {...stylex.props(styles.time)}>{ago(c.createdAt)}</span>
                {c.updatedAt && <span {...stylex.props(styles.edited)} title={`Edited ${ago(c.updatedAt)}`}>· edited</span>}
                {isMine && (
                  <button type="button" {...stylex.props(styles.editLink)} data-testid="collab-edit" onClick={() => startEdit(c)}>Edit</button>
                )}
              </div>
              <div {...stylex.props(styles.body)}>{renderBody(c)}</div>
            </div>
          </div>
        );
      })}

      <div {...stylex.props(styles.composerWrap)}>
        <textarea ref={taRef} {...stylex.props(styles.textarea)} aria-label={isEdit ? "Edit note" : "Add an internal note"}
          placeholder={isEdit ? "Edit note…" : "Add an internal note — try @ for people and 😊 for emoji"}
          value={body} onChange={onBodyChange}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) submit();
            if (e.key === "Escape" && isEdit) cancelEdit();
          }} />
        {mentionPicker && filtered.length > 0 && (
          <div {...stylex.props(styles.popover)} role="listbox" aria-label="Mention a person" data-testid="mention-picker">
            {filtered.map((p) => (
              <button key={p.userId} type="button" role="option" {...stylex.props(styles.popoverItem)} onClick={() => choosePerson(p)}>
                <Avatar name={p.name} size={20} colour={p.colour} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}
        {showEmoji && (
          <div {...stylex.props(styles.emojiPop)} role="dialog" aria-label="Insert emoji" data-testid="emoji-picker">
            {EMOJIS.map((e) => (
              <button key={e} type="button" {...stylex.props(styles.emojiBtn)} onClick={() => { insertAtCaret(e); setShowEmoji(false); }} aria-label={`Insert ${e}`}>{e}</button>
            ))}
          </div>
        )}
        <div {...stylex.props(styles.composerBar)}>
          <button type="button" {...stylex.props(styles.iconBtn)} aria-label="Insert emoji" data-testid="emoji-open" onClick={() => setShowEmoji((s) => !s)}>😊</button>
          <span {...stylex.props(styles.spacer)} aria-hidden="true" />
          {isEdit && (
            <button type="button" {...stylex.props(styles.ghost)} onClick={cancelEdit}><X size={12} /> Cancel</button>
          )}
          <button type="button" {...stylex.props(styles.primary)} disabled={!body.trim() || addM.isPending || editM.isPending}
            data-testid={isEdit ? "collab-save" : "collab-add"} onClick={submit}>
            <Check size={13} /> {isEdit ? "Save" : "Note"}
          </button>
        </div>
      </div>
      {(helper ?? "Notes stay inside Kanzen — they're never sent to the sender.")
        && <div {...stylex.props(styles.helper)}>{helper ?? "Notes stay inside Kanzen — they're never sent to the sender."}</div>}
    </section>
  );
}

const styles = stylex.create({
  surface: { backgroundColor: colors.note, border: `1px solid ${colors.noteLine}`, borderRadius: radius.md, padding: "14px 16px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" },
  head: { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 700, marginBottom: "4px" },
  row: { display: "flex", gap: "10px", alignItems: "flex-start", padding: "6px 0" },
  rowMain: { flex: 1, minWidth: 0 },
  meta: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" },
  author: { fontSize: "12px", fontWeight: 600, color: colors.ink },
  time: { fontSize: "11px", color: colors.ink3 },
  edited: { fontSize: "11px", color: colors.ink3, fontStyle: "italic" },
  editLink: { marginLeft: "auto", border: 0, backgroundColor: "transparent", color: colors.accent, cursor: "pointer", fontSize: "11.5px", fontWeight: 600, fontFamily: "inherit", padding: "0 2px", ":hover": { textDecoration: "underline" } },
  body: { fontSize: "13px", color: colors.ink2, lineHeight: 1.5, marginTop: "2px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  mention: { display: "inline-block", padding: "0 4px", borderRadius: radius.sm, backgroundColor: colors.accentSoft, color: colors.accent, fontWeight: 600 },
  composerWrap: { position: "relative", marginTop: "6px" },
  textarea: { width: "100%", boxSizing: "border-box", minHeight: "60px", maxHeight: "200px", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.noteLine}`, backgroundColor: colors.bgElev, color: colors.ink, fontSize: "13px", fontFamily: "inherit", resize: "vertical", outline: "none" },
  composerBar: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", border: `1px solid ${colors.noteLine}`, backgroundColor: colors.bgElev, color: colors.ink2, borderRadius: radius.sm, cursor: "pointer", fontSize: "14px", fontFamily: "inherit" },
  spacer: { flex: 1 },
  ghost: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: radius.sm, border: `1px solid ${colors.noteLine}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", fontFamily: "inherit" },
  primary: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "inherit" },
  popover: { position: "absolute", left: 0, bottom: "100%", marginBottom: "6px", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.md, boxShadow: colors.shadowPop, padding: "4px", display: "flex", flexDirection: "column", minWidth: "180px", zIndex: 30 },
  popoverItem: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", border: 0, backgroundColor: "transparent", color: colors.ink, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", borderRadius: radius.sm, textAlign: "left", ":hover": { backgroundColor: colors.bgSunken } },
  emojiPop: { position: "absolute", left: 0, bottom: "100%", marginBottom: "6px", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.md, boxShadow: colors.shadowPop, padding: "6px", display: "grid", gridTemplateColumns: "repeat(8, 26px)", gap: "2px", zIndex: 30 },
  emojiBtn: { width: "26px", height: "26px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, backgroundColor: "transparent", cursor: "pointer", fontSize: "16px", borderRadius: radius.sm, ":hover": { backgroundColor: colors.bgSunken } },
  helper: { fontSize: "11.5px", color: colors.ink3, marginTop: "6px" },
});

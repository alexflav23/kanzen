import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "./Pill";
import { useAuth } from "../state/AuthContext";
import { search, type SearchHit } from "../services/inbox";
import { nlQuery, type NlAnswer } from "../services/nl";
import { AgentRibbon } from "./AgentRibbon";

const styles = stylex.create({
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh", zIndex: 100 },
  panel: { width: "min(560px, 92vw)", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.lg, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" },
  input: { width: "100%", padding: "16px 18px", border: 0, borderBottom: `1px solid ${colors.line}`, fontSize: "16px", color: colors.ink, backgroundColor: colors.bgElev, outline: "none", boxSizing: "border-box" },
  list: { maxHeight: "48vh", overflowY: "auto" },
  row: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: `1px solid ${colors.line}`, cursor: "pointer" },
  grow: { flex: 1, minWidth: 0 },
  title: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  sub: { fontSize: "12px", color: colors.ink3 },
  hint: { padding: "16px 18px", fontSize: "13px", color: colors.ink3 },
  askRow: { display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left", padding: "12px 18px", borderBottom: `1px solid ${colors.line}`, border: 0, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: colors.line, background: "transparent", cursor: "pointer", color: colors.accent, fontSize: "14px", ":hover": { backgroundColor: colors.bgSunken } },
  kbd: { marginLeft: "auto", fontSize: "11px", color: colors.ink3, backgroundColor: colors.bgSunken, borderRadius: "4px", padding: "1px 6px" },
  answer: { padding: "14px 18px", borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgSunken },
  answerHead: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  answerQ: { fontSize: "12px", color: colors.ink3 },
  answerText: { fontSize: "14.5px", color: colors.ink, lineHeight: 1.45 },
});

/** F28 — ⌘K command palette. Opens on ⌘K/Ctrl-K from anywhere; queries the permission-filtered
  * search endpoint (a role only ever sees hits it could read directly — no leak via search). */
export function CommandPalette() {
  const { token, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [answer, setAnswer] = useState<NlAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canAsk = can("*", "admin"); // NL is Principal-only in v1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); else { setQ(""); setHits([]); setAnswer(null); setAskErr(false); } }, [open]);
  useEffect(() => { setAnswer(null); setAskErr(false); }, [q]); // a new query clears the prior answer

  const ask = () => {
    const prompt = q.trim();
    if (!canAsk || prompt.length < 2 || asking) return;
    setAsking(true);
    setAskErr(false);
    nlQuery(prompt, token).then(setAnswer).catch(() => setAskErr(true)).finally(() => setAsking(false));
  };

  useEffect(() => {
    if (!open || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      search(token, q.trim()).then((r) => setHits(r.hits)).catch(() => setHits([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q, open, token]);

  if (!open) return null;
  return (
    <div {...stylex.props(styles.overlay)} onClick={() => setOpen(false)} data-testid="command-palette">
      <div {...stylex.props(styles.panel)} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          {...stylex.props(styles.input)}
          aria-label="Search"
          placeholder={canAsk ? "Search, or ask a question…" : "Search assets, vendors, documents…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
        />
        <div {...stylex.props(styles.list)}>
          {answer && (
            <div {...stylex.props(styles.answer)} data-testid="nl-answer">
              <div {...stylex.props(styles.answerHead)}><AgentRibbon>Kanzen</AgentRibbon><span {...stylex.props(styles.answerQ)}>“{answer.prompt}”</span></div>
              <div {...stylex.props(styles.answerText)}>{answer.answer}</div>
            </div>
          )}
          {canAsk && q.trim().length >= 2 && !answer && (
            <button type="button" {...stylex.props(styles.askRow)} data-testid="cmdk-ask" onClick={ask}>
              {asking ? "Thinking…" : askErr ? "Couldn't answer that — try rephrasing." : `Ask Kanzen: “${q.trim()}”`}
              {!asking && !askErr && <span {...stylex.props(styles.kbd)}>↵</span>}
            </button>
          )}
          {q.trim().length < 2 ? (
            <div {...stylex.props(styles.hint)}>{canAsk ? "Search across everything you can see — or ask a question and press ↵." : "Type to search across everything you can see."}</div>
          ) : hits.length === 0 ? (
            <div {...stylex.props(styles.hint)} data-testid="cmdk-empty">No matches for “{q}”.</div>
          ) : (
            hits.map((h) => (
              <div key={`${h.entityType}:${h.entityId}`} {...stylex.props(styles.row)} data-testid="cmdk-result" onClick={() => setOpen(false)}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.title)}>{h.title}</div>
                  {h.subtitle && <div {...stylex.props(styles.sub)}>{h.subtitle}</div>}
                </div>
                <Pill>{h.entityType}</Pill>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

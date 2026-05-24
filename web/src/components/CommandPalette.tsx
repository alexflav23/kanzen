import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "./Pill";
import { useAuth } from "../state/AuthContext";
import { search, type SearchHit } from "../services/inbox";

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
});

/** F28 — ⌘K command palette. Opens on ⌘K/Ctrl-K from anywhere; queries the permission-filtered
  * search endpoint (a role only ever sees hits it could read directly — no leak via search). */
export function CommandPalette() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { if (open) inputRef.current?.focus(); else { setQ(""); setHits([]); } }, [open]);

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
          placeholder="Search assets, vendors, documents…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div {...stylex.props(styles.list)}>
          {q.trim().length < 2 ? (
            <div {...stylex.props(styles.hint)}>Type to search across everything you can see.</div>
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

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { createEvent, listEvents } from "../services/calendar";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", gap: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "620px" },
  filters: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px", flexWrap: "wrap" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  row: { display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  date: { width: "92px", flexShrink: 0, fontSize: "12.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1, minWidth: 0 },
  evTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  ro: { fontSize: "11px", color: colors.ink3, marginTop: "2px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", flexShrink: 0 },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—");
const catTone = (c: string): "default" | "accent" | "warn" => (c === "maintenance" ? "warn" : c === "task" ? "default" : "accent");

const CATS: [string, string | null][] = [["All", null], ["Delivery", "delivery"], ["Maintenance", "maintenance"], ["Booking", "booking"], ["Tasks", "task"]];
const NEW_CATS = ["manual", "delivery", "booking", "maintenance"];

function NewEventModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(iso(new Date()));
  const [category, setCategory] = useState("manual");
  const mutation = useMutation({
    mutationFn: () => createEvent(token, { title: title.trim(), on, category, propertyId: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-event" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (title.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New event</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
          <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Window cleaners" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Date</span>
          <input {...stylex.props(styles.control)} aria-label="Date" type="date" value={on} onChange={(e) => setOn(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Category</span>
          <select {...stylex.props(styles.control)} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {NEW_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        {mutation.isError && <div style={{ color: colors.danger, fontSize: "12.5px" }} role="alert">Couldn't create the event.</div>}
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !title.trim()}>
            {mutation.isPending ? "Adding…" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** F07 — household calendar (agenda). Merged native events + read-only task & maintenance
  * overlays over a date window; the prototype's week/month grids land later. */
export function Calendar() {
  const { token } = useAuth();
  const [cat, setCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const from = iso(new Date(now.getTime() - 7 * 864e5));
  const to = iso(new Date(now.getTime() + 60 * 864e5));

  const events = useQuery({
    queryKey: ["calendar", token, from, to, cat],
    queryFn: () => listEvents(token, from, to, cat),
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · Calendar</div>
          <h1 {...stylex.props(styles.title)}>Calendar</h1>
          <div {...stylex.props(styles.desc)}>Deliveries, maintenance, bookings and due tasks — the next 60 days. Task &amp; maintenance dates are shown read-only.</div>
        </div>
        <button type="button" onClick={() => setAdding(true)} {...stylex.props(styles.btn)}><Plus size={14} /> New event</button>
      </header>

      {adding && <NewEventModal token={token} onClose={() => setAdding(false)} />}

      <div {...stylex.props(styles.filters)}>
        {CATS.map(([label, value]) => (
          <button key={label} type="button" aria-pressed={cat === value} onClick={() => setCat(value)} {...stylex.props(styles.tab, cat === value && styles.tabActive)}>{label}</button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Next 60 days · {events.data?.length ?? 0}</CardTitle></CardHeader>
        {events.isPending ? <Loading /> : events.isError ? <ErrorState error={events.error} />
          : events.data.length === 0 ? <EmptyState title="Nothing scheduled">No events in this window.</EmptyState>
          : events.data.map((e) => (
            <div key={`${e.source}:${e.id}`} {...stylex.props(styles.row)} data-testid="cal-event">
              <div {...stylex.props(styles.date)}>{fmtDate(e.startOn)}</div>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.evTitle)}>{e.title}</div>
                {e.readOnly && <div {...stylex.props(styles.ro)}>from {e.source} · read-only</div>}
              </div>
              <Pill tone={catTone(e.category)}>{e.category}</Pill>
            </div>
          ))}
      </Card>
    </div>
  );
}

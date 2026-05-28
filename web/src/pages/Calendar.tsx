import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { createEvent, listEvents, type CalEvent } from "../services/calendar";

const styles = stylex.create({
  errorText: { color: colors.danger, fontSize: "12.5px" },
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
  // view toggle + grid (W6)
  headRight: { display: "flex", alignItems: "center", gap: "10px" },
  seg: { display: "inline-flex", gap: "2px", padding: "3px", borderRadius: radius.md, backgroundColor: colors.bgSunken },
  segBtn: { padding: "5px 12px", borderRadius: radius.sm, border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12.5px", fontWeight: 500 },
  segBtnOn: { backgroundColor: colors.bgElev, color: colors.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" },
  navRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" },
  navBtn: { width: "30px", height: "30px", display: "grid", placeItems: "center", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "15px", lineHeight: 1 },
  todayBtn: { padding: "6px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  monthLabel: { fontSize: "15px", fontWeight: 600, color: colors.ink, minWidth: "160px" },
  weekHead: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${colors.line}` },
  weekHeadCell: { padding: "8px 10px", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)" },
  cell: { minHeight: "104px", textAlign: "left", padding: "6px 7px", border: 0, borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" },
  cellOut: { backgroundColor: colors.bgSunken },
  cellToday: { boxShadow: `inset 0 0 0 2px ${colors.accent}` },
  dayNum: { fontSize: "12px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  dayNumToday: { color: colors.accent, fontWeight: 700 },
  chip: (bg: string, fg: string) => ({ fontSize: "11px", lineHeight: 1.25, padding: "2px 6px", borderRadius: "5px", backgroundColor: bg, color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
  more: { fontSize: "10.5px", color: colors.ink3, paddingLeft: "2px" },
});

// Category-tinted chip backgrounds; text is high-contrast `ink` (AA on every tint, both themes) — the
// colour cue lives in the background, not the text (the soft-tint + coloured-text combo fails AA at 11px).
const chipColors = (c: string): [string, string] => {
  const bg = c === "maintenance" ? colors.warnSoft : c === "task" ? colors.bgSunken : c === "delivery" ? colors.infoSoft : colors.accentSoft;
  return [bg, colors.ink];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—");
const catTone = (c: string): "default" | "accent" | "warn" => (c === "maintenance" ? "warn" : c === "task" ? "default" : "accent");
// local-date helpers (TZ-safe, unlike toISOString) for the month/week grid
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeekMon = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // Monday-start
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type View = "month" | "week" | "agenda";

const CATS: [string, string | null][] = [["All", null], ["Delivery", "delivery"], ["Maintenance", "maintenance"], ["Booking", "booking"], ["Tasks", "task"]];
const NEW_CATS = ["manual", "delivery", "booking", "maintenance"];

function NewEventModal({ token, date, onClose }: { token: string | null; date?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(date ?? iso(new Date()));
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
        {mutation.isError && <div {...stylex.props(styles.errorText)} role="alert">Couldn't create the event.</div>}
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

/** F07 — household calendar. Month / week grids + an agenda list over a date window; merged native
  * events with read-only task & maintenance overlays. Clicking a day opens the new-event form pre-dated. */
export function Calendar() {
  const { token } = useAuth();
  const [cat, setCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [presetDate, setPresetDate] = useState<string | undefined>(undefined);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const today = new Date();

  const gridDays = useMemo(() => {
    if (view === "week") { const s = startOfWeekMon(cursor); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    const s = startOfWeekMon(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(s, i)); // 6-week month grid
  }, [view, cursor]);

  const win = view === "agenda"
    ? { from: iso(addDays(today, -7)), to: iso(addDays(today, 60)) }
    : { from: ymd(gridDays[0]), to: ymd(gridDays[gridDays.length - 1]) };

  const events = useQuery({
    queryKey: ["calendar", token, win.from, win.to, cat],
    queryFn: () => listEvents(token, win.from, win.to, cat),
  });

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events.data ?? []) if (e.startOn) { const a = m.get(e.startOn) ?? []; a.push(e); m.set(e.startOn, a); }
    return m;
  }, [events.data]);

  const openNew = (date?: string) => { setPresetDate(date); setAdding(true); };
  const shift = (dir: number) => setCursor((c) => (view === "week" ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
  const label = view === "week"
    ? `${gridDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${gridDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    : cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · Calendar</div>
          <h1 {...stylex.props(styles.title)}>Calendar</h1>
          <div {...stylex.props(styles.desc)}>Deliveries, maintenance, bookings and due tasks. Task &amp; maintenance dates are read-only overlays.</div>
        </div>
        <div {...stylex.props(styles.headRight)}>
          <div {...stylex.props(styles.seg)} role="tablist" aria-label="Calendar view">
            {(["month", "week", "agenda"] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} {...stylex.props(styles.segBtn, view === v && styles.segBtnOn)} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <button type="button" onClick={() => openNew()} {...stylex.props(styles.btn)}><Plus size={14} /> New event</button>
        </div>
      </header>

      {adding && <NewEventModal token={token} date={presetDate} onClose={() => { setAdding(false); setPresetDate(undefined); }} />}

      <div {...stylex.props(styles.filters)}>
        {CATS.map(([labelTxt, value]) => (
          <button key={labelTxt} type="button" aria-pressed={cat === value} onClick={() => setCat(value)} {...stylex.props(styles.tab, cat === value && styles.tabActive)}>{labelTxt}</button>
        ))}
      </div>

      {view !== "agenda" && (
        <div {...stylex.props(styles.navRow)}>
          <button type="button" {...stylex.props(styles.navBtn)} aria-label="Previous" onClick={() => shift(-1)}>‹</button>
          <button type="button" {...stylex.props(styles.navBtn)} aria-label="Next" onClick={() => shift(1)}>›</button>
          <button type="button" {...stylex.props(styles.todayBtn)} onClick={() => setCursor(new Date())}>Today</button>
          <span {...stylex.props(styles.monthLabel)} data-testid="cal-period">{label}</span>
        </div>
      )}

      {view === "agenda" ? (
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
      ) : (
        <Card>
          {events.isError ? <ErrorState error={events.error} /> : (
            <>
              <div {...stylex.props(styles.weekHead)}>{WEEKDAYS.map((w) => <div key={w} {...stylex.props(styles.weekHeadCell)}>{w}</div>)}</div>
              <div {...stylex.props(styles.grid)} data-testid="cal-grid">
                {gridDays.map((d) => {
                  const key = ymd(d);
                  const out = view === "month" && d.getMonth() !== cursor.getMonth();
                  const isToday = key === ymd(today);
                  const evs = byDay.get(key) ?? [];
                  return (
                    <button key={key} type="button" data-testid="cal-day"
                      aria-label={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                      {...stylex.props(styles.cell, out && styles.cellOut, isToday && styles.cellToday)} onClick={() => openNew(key)}>
                      <span {...stylex.props(styles.dayNum, isToday && styles.dayNumToday)}>{d.getDate()}</span>
                      {evs.slice(0, 4).map((e) => {
                        const [bg, fg] = chipColors(e.category);
                        return <span key={`${e.source}:${e.id}`} {...stylex.props(styles.chip(bg, fg))} data-testid="cal-chip" title={e.title}>{e.title}</span>;
                      })}
                      {evs.length > 4 && <span {...stylex.props(styles.more)}>+{evs.length - 4} more</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

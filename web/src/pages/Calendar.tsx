import * as stylex from "@stylexjs/stylex";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { createEvent, deleteEvent, listEvents, updateEvent, type CalEvent } from "../services/calendar";

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
  rowBtn: { width: "100%", textAlign: "left", border: 0, borderBottom: `1px solid ${colors.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", ":hover": { backgroundColor: colors.bgSunken } },
  date: { width: "92px", flexShrink: 0, fontSize: "12.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1, minWidth: 0 },
  evTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  ro: { fontSize: "11px", color: colors.ink3, marginTop: "2px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", flexShrink: 0 },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50, animationName: stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }), animationDuration: "120ms" },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px", animationName: stylex.keyframes({ from: { opacity: 0, transform: "translateY(6px) scale(0.97)" }, to: { opacity: 1, transform: "translateY(0) scale(1)" } }), animationDuration: "160ms", animationTimingFunction: "ease-out" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  spacer: { flex: 1 },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px", fontFamily: "inherit" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontFamily: "inherit" },
  danger: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.dangerSoft}`, backgroundColor: colors.dangerSoft, color: colors.danger, cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "inherit" },
  confirmText: { fontSize: "13px", color: colors.ink2 },
  // view toggle + month grid
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
  // the cell is a non-interactive box; the full-bleed `cellAdd` button (behind the content) handles "new event on
  // this day", while the content layer is pointer-transparent so empty space falls through to it — but the chips
  // (pointer-events restored) capture their own clicks to open the event detail. This keeps both behaviours without
  // nesting a button inside a button (which fails the a11y nested-interactive rule).
  cellBox: { position: "relative", minHeight: "104px", borderRight: `1px solid ${colors.line}`, borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, overflow: "hidden" },
  cellOut: { backgroundColor: colors.bgSunken },
  cellToday: { boxShadow: `inset 0 0 0 2px ${colors.accent}` },
  cellAdd: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "transparent", cursor: "pointer", padding: 0 },
  cellContent: { position: "relative", zIndex: 1, pointerEvents: "none", display: "flex", flexDirection: "column", gap: "3px", padding: "6px 7px", height: "100%", boxSizing: "border-box" },
  dayNum: { fontSize: "12px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  dayNumToday: { color: colors.accent, fontWeight: 700 },
  chip: (bg: string, fg: string) => ({ fontSize: "11px", lineHeight: 1.25, padding: "2px 6px", borderRadius: "5px", backgroundColor: bg, color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
  // a chip rendered as a real button (so it's clickable + keyboard-focusable) — resets button chrome, restores
  // pointer events (the content layer disables them), and the `chip(bg,fg)` tint is layered on top.
  chipBtn: { pointerEvents: "auto", display: "block", width: "100%", textAlign: "left", border: 0, margin: 0, fontFamily: "inherit", cursor: "pointer" },
  more: { pointerEvents: "auto", display: "block", textAlign: "left", border: 0, background: "transparent", fontSize: "10.5px", color: colors.ink3, paddingLeft: "2px", cursor: "pointer" },
  // event-detail modal
  dl: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" },
  dt: { fontSize: "12px", color: colors.ink3, marginBottom: "4px" },
  dd: { fontSize: "14px", color: colors.ink, fontVariantNumeric: "tabular-nums" },
  note: { marginTop: "16px", fontSize: "12.5px", color: colors.ink3, backgroundColor: colors.bgSunken, borderRadius: radius.sm, padding: "10px 12px", lineHeight: 1.4 },
  // timed hour-grid (week / day)
  tgHead: (cols: number) => ({ display: "grid", gridTemplateColumns: `56px repeat(${cols}, 1fr)`, borderBottom: `1px solid ${colors.line}` }),
  tgGutterCell: { padding: "8px 6px" },
  tgDayHead: { padding: "8px 10px", fontSize: "12px", color: colors.ink3, borderLeft: `1px solid ${colors.line}`, textTransform: "uppercase", letterSpacing: "0.03em" },
  tgDayHeadToday: { color: colors.accent, fontWeight: 700 },
  tgDayNum: { fontVariantNumeric: "tabular-nums" },
  tgAllDayLabel: { fontSize: "10px", color: colors.ink4, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center" },
  tgAllDayCell: { padding: "5px 6px", borderLeft: `1px solid ${colors.line}`, display: "flex", flexDirection: "column", gap: "3px", minHeight: "26px" },
  tgBody: (cols: number) => ({ display: "grid", gridTemplateColumns: `56px repeat(${cols}, 1fr)`, maxHeight: "620px", overflowY: "auto" }),
  tgGutter: { display: "flex", flexDirection: "column" },
  tgHourLabel: { height: "48px", fontSize: "11px", color: colors.ink3, textAlign: "right", paddingRight: "8px", paddingTop: "2px", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" },
  tgDayCol: { position: "relative", borderLeft: `1px solid ${colors.line}` },
  tgSlot: { display: "block", width: "100%", height: "48px", borderTop: `1px solid ${colors.line}`, border: 0, borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: colors.line, background: "transparent", cursor: "pointer", boxSizing: "border-box" },
  tgEvent: (top: number, height: number, bg: string, fg: string) => ({
    position: "absolute", left: "3px", right: "3px", top: `${top}px`, height: `${height}px`,
    backgroundColor: bg, color: fg, borderRadius: "6px", padding: "3px 7px", fontSize: "11px", lineHeight: 1.3,
    overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.10)",
    border: 0, textAlign: "left", fontFamily: "inherit", cursor: "pointer",
  }),
  tgEventTime: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
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
// local-date helpers (TZ-safe, unlike toISOString) for the grids
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeekMon = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // Monday-start
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type View = "month" | "week" | "day" | "agenda";

// timed hour-grid window (property-local wall-clock; no zone) — 07:00–22:00
const START_HOUR = 7, END_HOUR = 22, HOUR_H = 48;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i); // 7..21
const parseMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const fmtTime = (t: string) => t.slice(0, 5);

const CATS: [string, string | null][] = [["All", null], ["Delivery", "delivery"], ["Maintenance", "maintenance"], ["Booking", "booking"], ["Tasks", "task"]];
const NEW_CATS = ["manual", "delivery", "booking", "maintenance"];

function NewEventModal({ token, date, time, onClose }: { token: string | null; date?: string; time?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(date ?? iso(new Date()));
  const [category, setCategory] = useState("manual");
  const [startTime, setStartTime] = useState(time ?? "");
  const [endTime, setEndTime] = useState("");
  const mutation = useMutation({
    mutationFn: () => createEvent(token, {
      title: title.trim(), on, category, propertyId: null,
      ...(startTime ? { startTime, endTime: endTime || null } : {}),
    }),
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
        <div {...stylex.props(styles.field, styles.twoCol)}>
          <label><span {...stylex.props(styles.label)}>Start time</span>
            <input {...stylex.props(styles.control)} aria-label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label><span {...stylex.props(styles.label)}>End time</span>
            <input {...stylex.props(styles.control)} aria-label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>
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

// where a read-only overlay event can actually be edited (it isn't a native calendar event)
const sourceHome = (s: string): { label: string; route: string } | null =>
  s === "task" ? { label: "Tasks", route: "/tasks" }
  : s === "maintenance" ? { label: "Maintenance", route: "/maintenance" }
  : s === "leave" ? { label: "People", route: "/people" }
  : null;

/** Event detail — opened by clicking any event. Native events get Edit + Delete in place; read-only overlays
 *  (task / maintenance / leave) get a deep-link to the surface where they actually live, with a clear
 *  read-only framing. Esc + outside click close; subtle fade/pop-in animation. */
function EventDetailModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const home = sourceHome(event.source);

  // Edit form state (mirrors NewEventModal). Prefilled from the current event.
  const [title, setTitle] = useState(event.title);
  const [on, setOn] = useState(event.startOn ?? iso(new Date()));
  const [category, setCategory] = useState(event.category);
  const [startTime, setStartTime] = useState(event.startTime ? event.startTime.slice(0, 5) : "");
  const [endTime, setEndTime] = useState(event.endTime ? event.endTime.slice(0, 5) : "");

  const editM = useMutation({
    mutationFn: () => updateEvent(token, event.id, {
      title: title.trim(), on, category,
      startTime: startTime || null, endTime: startTime ? (endTime || null) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); onClose(); },
  });
  const delM = useMutation({
    mutationFn: () => deleteEvent(token, event.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); onClose(); },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const time = event.startTime ? `${fmtTime(event.startTime)}${event.endTime ? `–${fmtTime(event.endTime)}` : ""}` : "All day";
  const isEdit = mode === "edit" && !event.readOnly;

  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" aria-label="Event detail" onClick={onClose}>
      <div {...stylex.props(styles.modal)} data-testid="event-detail" onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.modalTitle)}>{isEdit ? "Edit event" : event.title}</div>

        {!isEdit && (
          <dl {...stylex.props(styles.dl)}>
            <div><dt {...stylex.props(styles.dt)}>Date</dt><dd {...stylex.props(styles.dd)}>{fmtDate(event.startOn)}</dd></div>
            <div><dt {...stylex.props(styles.dt)}>Time</dt><dd {...stylex.props(styles.dd)}>{time}</dd></div>
            <div><dt {...stylex.props(styles.dt)}>Category</dt><dd><Pill tone={catTone(event.category)}>{event.category}</Pill></dd></div>
            <div><dt {...stylex.props(styles.dt)}>Source</dt><dd {...stylex.props(styles.dd)}>{event.source}</dd></div>
          </dl>
        )}

        {isEdit && (
          <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) editM.mutate(); }}>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
              <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Date</span>
              <input {...stylex.props(styles.control)} aria-label="Date" type="date" value={on} onChange={(e) => setOn(e.target.value)} /></label>
            <div {...stylex.props(styles.field, styles.twoCol)}>
              <label><span {...stylex.props(styles.label)}>Start time</span>
                <input {...stylex.props(styles.control)} aria-label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
              <label><span {...stylex.props(styles.label)}>End time</span>
                <input {...stylex.props(styles.control)} aria-label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
            </div>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Category</span>
              <select {...stylex.props(styles.control)} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {NEW_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
            {editM.isError && <div {...stylex.props(styles.errorText)} role="alert">Couldn't save the changes.</div>}
            <input type="submit" hidden />
          </form>
        )}

        {event.readOnly && !isEdit && (
          <div {...stylex.props(styles.note)} data-testid="event-readonly">
            Read-only overlay{home ? ` — manage it under ${home.label}` : ""}. Calendar dates for {event.source}s follow the underlying record.
          </div>
        )}
        {delM.isError && <div {...stylex.props(styles.errorText)} role="alert">Couldn't delete the event.</div>}

        <div {...stylex.props(styles.actions)}>
          {/* Read-only overlay → deep-link to source */}
          {event.readOnly && home && (
            <button type="button" {...stylex.props(styles.primary)} data-testid="event-open-source"
              onClick={() => { onClose(); navigate(home.route); }}>Open in {home.label}</button>
          )}

          {/* Native event, view mode → Edit + Delete + Close */}
          {!event.readOnly && !isEdit && !confirmingDelete && (<>
            <button type="button" {...stylex.props(styles.danger)} data-testid="event-delete"
              onClick={() => setConfirmingDelete(true)}>Delete</button>
            <span {...stylex.props(styles.spacer)} aria-hidden="true" />
            <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Close</button>
            <button type="button" {...stylex.props(styles.primary)} data-testid="event-edit" onClick={() => setMode("edit")}>Edit</button>
          </>)}

          {/* Confirm step — no double-click traps for destructive action */}
          {confirmingDelete && (<>
            <span {...stylex.props(styles.confirmText)}>Delete this event?</span>
            <span {...stylex.props(styles.spacer)} aria-hidden="true" />
            <button type="button" {...stylex.props(styles.ghost)} onClick={() => setConfirmingDelete(false)} disabled={delM.isPending}>Cancel</button>
            <button type="button" {...stylex.props(styles.danger)} data-testid="event-delete-confirm"
              disabled={delM.isPending} onClick={() => delM.mutate()}>{delM.isPending ? "Deleting…" : "Delete"}</button>
          </>)}

          {/* Edit mode → Cancel + Save */}
          {isEdit && (<>
            <span {...stylex.props(styles.spacer)} aria-hidden="true" />
            <button type="button" {...stylex.props(styles.ghost)} onClick={() => setMode("view")}>Cancel</button>
            <button type="button" {...stylex.props(styles.primary)} data-testid="event-save"
              disabled={editM.isPending || !title.trim()}
              onClick={() => editM.mutate()}>{editM.isPending ? "Saving…" : "Save"}</button>
          </>)}

          {/* Pure read-only with no source → just Close */}
          {event.readOnly && !home && (
            <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A timed hour-grid (07:00–22:00) for the Week (7 columns) and Day (1 column) views. Times are
 * property-local wall-clock; timeless events (tasks, maintenance, untimed) sit in the all-day strip. */
function TimeGrid({ days, byDay, onSlot, onEvent }: { days: Date[]; byDay: Map<string, CalEvent[]>; onSlot: (date: string, hour: number) => void; onEvent: (e: CalEvent) => void }) {
  const cols = days.length;
  const todayKey = ymd(new Date());
  return (
    <div data-testid="cal-timegrid">
      <div {...stylex.props(styles.tgHead(cols))}>
        <div {...stylex.props(styles.tgGutterCell)} />
        {days.map((d) => (
          <div key={ymd(d)} {...stylex.props(styles.tgDayHead, ymd(d) === todayKey && styles.tgDayHeadToday)}>
            {d.toLocaleDateString("en-GB", { weekday: "short" })} <span {...stylex.props(styles.tgDayNum)}>{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div {...stylex.props(styles.tgHead(cols))}>
        <div {...stylex.props(styles.tgGutterCell, styles.tgAllDayLabel)}>all-day</div>
        {days.map((d) => {
          const allDay = (byDay.get(ymd(d)) ?? []).filter((e) => !e.startTime);
          return (
            <div key={ymd(d)} {...stylex.props(styles.tgAllDayCell)} data-testid="cal-allday">
              {allDay.map((e) => { const [bg, fg] = chipColors(e.category); return <button key={`${e.source}:${e.id}`} type="button" {...stylex.props(styles.chipBtn, styles.chip(bg, fg))} title={e.title} onClick={() => onEvent(e)}>{e.title}</button>; })}
            </div>
          );
        })}
      </div>
      <div {...stylex.props(styles.tgBody(cols))}>
        <div {...stylex.props(styles.tgGutter)}>
          {HOURS.map((h) => <div key={h} {...stylex.props(styles.tgHourLabel)}>{pad(h)}:00</div>)}
        </div>
        {days.map((d) => {
          const key = ymd(d);
          const timed = (byDay.get(key) ?? []).filter((e) => e.startTime);
          return (
            <div key={key} {...stylex.props(styles.tgDayCol)} data-testid="cal-daycol">
              {HOURS.map((h) => (
                <button key={h} type="button" {...stylex.props(styles.tgSlot)}
                  aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} ${pad(h)}:00`}
                  onClick={() => onSlot(key, h)} />
              ))}
              {timed.map((e) => {
                const start = parseMin(e.startTime!);
                const end = e.endTime ? parseMin(e.endTime) : start + 60;
                const top = Math.max(0, ((start - START_HOUR * 60) / 60) * HOUR_H);
                const height = Math.max(22, ((Math.min(end, END_HOUR * 60) - start) / 60) * HOUR_H - 2);
                const [bg, fg] = chipColors(e.category);
                return (
                  <button key={`${e.source}:${e.id}`} type="button" {...stylex.props(styles.tgEvent(top, height, bg, fg))} data-testid="cal-block" title={`${fmtTime(e.startTime!)} ${e.title}`} onClick={() => onEvent(e)}>
                    <span {...stylex.props(styles.tgEventTime)}>{fmtTime(e.startTime!)}</span> {e.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** F07 — household calendar. Month grid · timed Week/Day hour-grids · agenda list, over a date window;
  * merged native events with read-only task & maintenance overlays. Clicking a day/hour opens the
  * new-event form pre-filled. Times are property-local wall-clock (no cross-zone conversion). */
export function Calendar() {
  const { token } = useAuth();
  const [cat, setCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [presetDate, setPresetDate] = useState<string | undefined>(undefined);
  const [presetTime, setPresetTime] = useState<string | undefined>(undefined);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const today = new Date();

  const gridDays = useMemo(() => {
    if (view === "day") return [new Date(cursor)];
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

  const openNew = (date?: string, time?: string) => { setPresetDate(date); setPresetTime(time); setAdding(true); };
  const openDetail = (e: CalEvent) => setDetail(e);
  const shift = (dir: number) => setCursor((c) =>
    view === "day" ? addDays(c, dir) : view === "week" ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1));
  const label = view === "day"
    ? cursor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : view === "week"
      ? `${gridDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${gridDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · Calendar</div>
          <h1 {...stylex.props(styles.title)}>Calendar</h1>
          <div {...stylex.props(styles.desc)}>Deliveries, maintenance, bookings and due tasks. Times are property-local; task &amp; maintenance dates are read-only overlays.</div>
        </div>
        <div {...stylex.props(styles.headRight)}>
          <div {...stylex.props(styles.seg)} role="tablist" aria-label="Calendar view">
            {(["month", "week", "day", "agenda"] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} {...stylex.props(styles.segBtn, view === v && styles.segBtnOn)} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <button type="button" onClick={() => openNew()} {...stylex.props(styles.btn)}><Plus size={14} /> New event</button>
        </div>
      </header>

      {adding && <NewEventModal token={token} date={presetDate} time={presetTime} onClose={() => { setAdding(false); setPresetDate(undefined); setPresetTime(undefined); }} />}
      {detail && <EventDetailModal event={detail} onClose={() => setDetail(null)} />}

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
              <button key={`${e.source}:${e.id}`} type="button" {...stylex.props(styles.row, styles.rowBtn)} data-testid="cal-event"
                aria-label={`${e.title}, ${fmtDate(e.startOn)} — view event`} onClick={() => openDetail(e)}>
                <div {...stylex.props(styles.date)}>{fmtDate(e.startOn)}{e.startTime ? ` · ${fmtTime(e.startTime)}` : ""}</div>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.evTitle)}>{e.title}</div>
                  {e.readOnly && <div {...stylex.props(styles.ro)}>from {e.source} · read-only</div>}
                </div>
                <Pill tone={catTone(e.category)}>{e.category}</Pill>
              </button>
            ))}
        </Card>
      ) : view === "month" ? (
        <Card>
          {events.isError ? <ErrorState error={events.error} /> : (
            <>
              <div {...stylex.props(styles.weekHead)}>{WEEKDAYS.map((w) => <div key={w} {...stylex.props(styles.weekHeadCell)}>{w}</div>)}</div>
              <div {...stylex.props(styles.grid)} data-testid="cal-grid">
                {gridDays.map((d) => {
                  const key = ymd(d);
                  const out = d.getMonth() !== cursor.getMonth();
                  const isToday = key === ymd(today);
                  const evs = byDay.get(key) ?? [];
                  return (
                    <div key={key} {...stylex.props(styles.cellBox, out && styles.cellOut, isToday && styles.cellToday)}>
                      <button type="button" data-testid="cal-day" {...stylex.props(styles.cellAdd)}
                        aria-label={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                        onClick={() => openNew(key)} />
                      <div {...stylex.props(styles.cellContent)}>
                        <span {...stylex.props(styles.dayNum, isToday && styles.dayNumToday)}>{d.getDate()}</span>
                        {evs.slice(0, 4).map((e) => {
                          const [bg, fg] = chipColors(e.category);
                          return <button key={`${e.source}:${e.id}`} type="button" {...stylex.props(styles.chipBtn, styles.chip(bg, fg))} data-testid="cal-chip" title={e.title} onClick={() => openDetail(e)}>{e.startTime ? `${fmtTime(e.startTime)} ` : ""}{e.title}</button>;
                        })}
                        {evs.length > 4 && <button type="button" {...stylex.props(styles.more)} onClick={() => { setCursor(d); setView("day"); }}>+{evs.length - 4} more</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card>
          {events.isError ? <ErrorState error={events.error} /> : <TimeGrid days={gridDays} byDay={byDay} onSlot={(date, hour) => openNew(date, `${pad(hour)}:00`)} onEvent={openDetail} />}
        </Card>
      )}
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { listEvents } from "../services/calendar";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  filters: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px", flexWrap: "wrap" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  row: { display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  date: { width: "92px", flexShrink: 0, fontSize: "12.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1, minWidth: 0 },
  evTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  ro: { fontSize: "11px", color: colors.ink3, marginTop: "2px" },
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—");
const catTone = (c: string): "default" | "accent" | "warn" => (c === "maintenance" ? "warn" : c === "task" ? "default" : "accent");

const CATS: [string, string | null][] = [["All", null], ["Delivery", "delivery"], ["Maintenance", "maintenance"], ["Booking", "booking"], ["Tasks", "task"]];

/** F07 — household calendar (agenda). Merged native events + read-only task & maintenance
  * overlays over a date window; the prototype's week/month grids land later. */
export function Calendar() {
  const { token } = useAuth();
  const [cat, setCat] = useState<string | null>(null);
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
        <div {...stylex.props(styles.eyebrow)}>Operations · Calendar</div>
        <h1 {...stylex.props(styles.title)}>Calendar</h1>
        <div {...stylex.props(styles.desc)}>Deliveries, maintenance, bookings and due tasks — the next 60 days. Task &amp; maintenance dates are shown read-only.</div>
      </header>

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

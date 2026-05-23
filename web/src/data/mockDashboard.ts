// Dashboard seed data — mirrors the design prototype's dashboard.jsx content.
// (The prototype's data.jsx wasn't in the download; reconstructed from the
// rendered preview + the view source. Real screens wire to the APIs later.)

const NOW = new Date("2026-05-22T08:00:00Z"); // the prototype's "Friday 22 May 2026"

export const TODAY_EYEBROW = "Friday · 22 May 2026";

export type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  property: string;
  category: string;
  color: string;
  source?: "agent" | "manual";
};

export const UPCOMING: UpcomingEvent[] = [
  { id: "u1", title: "Waitrose delivery", date: "2026-05-26", time: "11:00–12:00", property: "Wardian", category: "Delivery", color: "#6366f1", source: "agent" },
  { id: "u2", title: "HVAC quarterly service", date: "2026-05-27", time: "09:00", property: "Wardian", category: "Maintenance", color: "#b45309" },
  { id: "u3", title: "Marcia — day off", date: "2026-05-28", time: "All day", property: "Wardian", category: "People", color: "#15803d" },
  { id: "u4", title: "Wine delivery — Berry Bros", date: "2026-05-30", time: "14:00", property: "Wardian", category: "Delivery", color: "#6366f1", source: "agent" },
  { id: "u5", title: "Aircon service", date: "2026-06-02", time: "10:00", property: "Singapore", category: "Maintenance", color: "#b45309", source: "agent" },
];

export type Budget = { propertyId: string; propertyName: string; spent: number; budget: number; currency: string; periods: number[] };

export const BUDGETS: Budget[] = [
  { propertyId: "wardian", propertyName: "Wardian, Apt 5206", spent: 642000, budget: 900000, currency: "GBP", periods: [40, 55, 48, 62, 71] },
  { propertyId: "singapore", propertyName: "Singapore", spent: 318000, budget: 500000, currency: "SGD", periods: [30, 42, 38, 50, 64] },
];

export type AgentActivity = { id: string; title: string; category: string; action: string; outcome: string; at: string };

export const AGENT_HISTORY: AgentActivity[] = [
  { id: "a1", title: "Filed John Lewis receipt", category: "Delivery", action: "matched", outcome: "receipt stored", at: "2026-05-22T06:10:00Z" },
  { id: "a2", title: "Reconciled SP Group invoice", category: "Bill", action: "reconciled", outcome: "+£12 vs estimate", at: "2026-05-22T05:55:00Z" },
  { id: "a3", title: "Created appointment · Aircon service", category: "Calendar", action: "added", outcome: "Singapore", at: "2026-05-21T18:20:00Z" },
  { id: "a4", title: "Flagged home insurance renewal", category: "Renewal", action: "flagged", outcome: "38 days", at: "2026-05-21T09:05:00Z" },
];

export type Expiring = { id: string; item: string; kind: string; until: string; days: number; lapsed?: boolean };

export const EXPIRING: Expiring[] = [
  { id: "x1", item: "Siti — work permit", kind: "Permit", until: "2026-07-12", days: 51 },
  { id: "x2", item: "Home insurance — Wardian", kind: "Policy", until: "2026-06-30", days: 39 },
  { id: "x3", item: "Range Rover — warranty", kind: "Warranty", until: "2026-06-18", days: 27 },
  { id: "x4", item: "Fire safety cert — Singapore", kind: "Compliance", until: "2026-05-10", days: -12, lapsed: true },
];

export type ListSummary = { id: string; name: string; total: number; needsApproval: number; nextOrder: string };

export const LISTS: ListSummary[] = [
  { id: "l1", name: "Kitchen staples", total: 12, needsApproval: 2, nextOrder: "2026-05-26" },
  { id: "l2", name: "Wine cellar", total: 6, needsApproval: 1, nextOrder: "2026-05-30" },
  { id: "l3", name: "Cleaning supplies", total: 9, needsApproval: 0, nextOrder: "2026-05-28" },
];

export const CONNECTED = [
  { name: "Todoist", status: "Connected" },
  { name: "Gmail", status: "5 mailboxes" },
  { name: "Calendar", status: "household" },
  { name: "Drive", status: "2 shared" },
];

export const TRIAGE_COUNT = 5;

// ── formatting helpers (design uses £ and S$) ───────────────────────────────
export function fmtMoney(minor: number, currency: string): string {
  const whole = Math.round(minor / 100).toLocaleString("en-GB");
  if (currency === "GBP") return `£${whole}`;
  if (currency === "SGD") return `S$${whole}`;
  return `${currency} ${whole}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtDayLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function dayParts(iso: string): { m: string; d: number } {
  const date = new Date(iso);
  return { m: date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(), d: date.getDate() };
}

export function relativeTime(iso: string): string {
  const mins = Math.round((NOW.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

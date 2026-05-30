import * as stylex from "@stylexjs/stylex";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../state/AuthContext";
import { listEvents } from "../services/calendar";
import { listExpenses } from "../services/finance";
import { listActions } from "../services/inbox";
import { listProperties } from "../services/properties";
import { listPeople, daysUntil } from "../services/people";
import { listLists, listItems } from "../services/lists";
import { fmtMoney } from "../data/money";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { AgentRibbon } from "../components/AgentRibbon";
import { SetupBanner } from "../components/SetupBanner";
import { Pill } from "../components/Pill";
import { Plus, ChevronRight, ArrowRight, Box } from "../components/icons";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "36px", gap: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.10em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  display: { fontSize: "44px", lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.028em", color: colors.ink },
  sub: { color: colors.ink3, marginTop: "8px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  heroCard: { marginBottom: "32px" },
  heroGrid: { display: "grid", gridTemplateColumns: "1fr 1fr" },
  heroSolo: { display: "grid", gridTemplateColumns: "1fr" },
  heroCell: { display: "flex", alignItems: "center", gap: "12px", padding: "22px 28px", borderWidth: 0, backgroundColor: "transparent", textAlign: "left", cursor: "pointer", color: colors.ink },
  heroDivider: { borderRightWidth: "1px", borderRightStyle: "solid", borderRightColor: colors.line },
  grow: { flex: 1, minWidth: 0 },
  rowGap8: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  h2: { fontSize: "20px", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: "4px" },
  small: { fontSize: "12.5px", color: colors.ink3 },
  body: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "28px", alignItems: "start", "@media (max-width: 980px)": { gridTemplateColumns: "1fr" } },
  col: { display: "flex", flexDirection: "column", gap: "24px" },
  ghost: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderWidth: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12.5px" },
  dateChip: { width: "48px", height: "48px", backgroundColor: colors.bgSunken, borderRadius: radius.md, display: "grid", placeItems: "center", textAlign: "center", flexShrink: 0 },
  dateM: { fontSize: "10px", color: colors.ink3, letterSpacing: "0.08em" },
  dateD: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "-2px", fontVariantNumeric: "tabular-nums" },
  evTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  cover: { width: "40px", height: "40px", borderRadius: radius.md, flexShrink: 0 },
  listIcon: { width: "36px", height: "36px", borderRadius: "10px", backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", color: colors.ink2, flexShrink: 0 },
  hRow: { display: "flex", alignItems: "center", gap: "10px" },
  body135: { fontSize: "13.5px", color: colors.ink },
  amount: { fontSize: "14px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: colors.ink },
  pillRow: { display: "flex", gap: "6px", marginTop: "4px" },
  coverWardian: { backgroundImage: "linear-gradient(135deg,#1B1F2E,#3B3F55)" },
  coverSingapore: { backgroundImage: "linear-gradient(135deg,#243B47,#3D6B7D)" },
  coverAlt: { backgroundImage: "linear-gradient(135deg,#3A2E2E,#6B5340)" },
  empty: { padding: "20px 22px", fontSize: "13px", color: colors.ink3 },
});

const covers = [styles.coverWardian, styles.coverSingapore, styles.coverAlt];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayParts = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return { m: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(), d: d.getDate() };
};
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fmtDayLong = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** One "This week's lists" row — fetches its items to show real count + pending-approval badge. */
function DashListRow({ id, name, nextOrder, token, onClick }: { id: string; name: string; nextOrder: string | null; token: string | null; onClick: () => void }) {
  const itemsQ = useQuery({ queryKey: ["list-items", id, token], queryFn: () => listItems(id, token) });
  const items = itemsQ.data ?? [];
  const total = items.filter((i) => i.status !== "declined").length;
  const needs = items.filter((i) => i.status === "needs_approval").length;
  return (
    <CardRow onClick={onClick}>
      <div {...stylex.props(styles.listIcon)}><Box size={15} /></div>
      <div {...stylex.props(styles.grow)}>
        <div {...stylex.props(styles.evTitle)}>{name}</div>
        <div {...stylex.props(styles.small)}>{plural(total, "item")}{nextOrder ? ` · orders ${fmtDayLong(nextOrder)}` : ""}</div>
      </div>
      {needs > 0 && <Pill tone="warn">{needs} to review</Pill>}
    </CardRow>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { token, me, role } = useAuth();
  const firstName = me?.name?.split(" ")[0]; // greet whoever is effectively signed in (incl. the impersonated user)
  // The review surfaces — triage (agent proposals), expenses, and permit/review expiries — are
  // Principal/Manager-only (house rule). Staff personas must not even fire those reads, or the
  // server 403s and the browser logs an error. Gate on the token-derived role so it flips the
  // instant the bearer changes (e.g. impersonation), with no /api/me lag.
  const canReview = role != null && role !== "staff";

  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86_400_000);

  const proposed = useQuery({ queryKey: ["agent-actions", "proposed", token], queryFn: () => listActions(token, "proposed"), enabled: !!token && canReview });
  const pendingExp = useQuery({ queryKey: ["expenses", "pending_approval", token], queryFn: () => listExpenses(token, "pending_approval"), enabled: !!token && canReview });
  const events = useQuery({ queryKey: ["events", iso(today), iso(in14), token], queryFn: () => listEvents(token, iso(today), iso(in14)) });
  const props = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const people = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token), enabled: !!token && canReview });
  const lists = useQuery({ queryKey: ["lists", token], queryFn: () => listLists(token) });

  const triage = proposed.data ?? [];
  const pend = pendingExp.data ?? [];

  // Triage breakdown by category (real).
  const byCat = triage.reduce<Record<string, number>>((m, a) => {
    const k = a.category ?? "Other";
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  const triageBreakdown = Object.entries(byCat).map(([c, n]) => plural(n, c.toLowerCase())).join(" · ") || "Nothing waiting";

  const upcoming = (events.data ?? []).filter((e) => e.startOn).sort((a, b) => a.startOn!.localeCompare(b.startOn!)).slice(0, 6);

  // Expiring within 60 days — real permits + staff review cycles.
  const expiring = (people.data ?? []).flatMap((p) => {
    const out: { id: string; who: string; kind: string; until: string; days: number }[] = [];
    const pe = daysUntil(p.permitExpiry);
    if (p.permitExpiry && pe !== null && pe <= 60) out.push({ id: `${p.id}-permit`, who: `${p.name} — work permit`, kind: "Permit", until: p.permitExpiry, days: pe });
    const rd = daysUntil(p.reviewDue);
    if (p.reviewDue && rd !== null && rd <= 60) out.push({ id: `${p.id}-review`, who: `${p.name} — review due`, kind: "Review", until: p.reviewDue, days: rd });
    return out;
  }).sort((a, b) => a.days - b.days);

  const properties = (props.data ?? []).slice(0, 4);
  const weekLists = (lists.data ?? []).slice(0, 4);
  const topExpenseSummary = pend.slice(0, 2).map((e) => `${fmtMoney(e.amountMinor, e.currency)} · ${e.payee ?? "—"}`).join(" · ");

  return (
    <div>
      <SetupBanner />
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>{today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <h1 {...stylex.props(styles.display)}>{greeting()}{firstName ? `, ${firstName}` : ""}.</h1>
          <div {...stylex.props(styles.sub)}>
            {plural(triage.length, "item")} awaiting your review, {plural(pend.length, "expense")} for approval.
          </div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} onClick={() => navigate("/inbox")}>
          <Plus size={14} /> Quick add
        </button>
      </header>

      {/* Attention strip — the Principal/Manager review surface: real triage + expenses awaiting you */}
      {canReview && (
        <Card style={styles.heroCard}>
          <div {...stylex.props(styles.heroGrid)}>
            <button type="button" onClick={() => navigate("/inbox")} {...stylex.props(styles.heroCell, styles.heroDivider)}>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.rowGap8)}><AgentRibbon /></div>
                <div {...stylex.props(styles.h2)}>{plural(triage.length, "item")} in Triage</div>
                <div {...stylex.props(styles.small)}>{triageBreakdown}</div>
              </div>
              <ChevronRight size={18} />
            </button>
            <button type="button" data-testid="approvals-cta" onClick={() => navigate("/finance")} {...stylex.props(styles.heroCell)}>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.rowGap8)}><Pill tone="warn">Awaiting you</Pill></div>
                <div {...stylex.props(styles.h2)}>{plural(pend.length, "expense")} to approve</div>
                <div {...stylex.props(styles.small)}>{topExpenseSummary || "Nothing awaiting approval"}</div>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </Card>
      )}

      <div {...stylex.props(styles.body)}>
        {/* Left column */}
        <div {...stylex.props(styles.col)}>
          <Card>
            <CardHeader>
              <div {...stylex.props(styles.hRow)}><CardTitle>Upcoming</CardTitle><Pill>Next 14 days</Pill></div>
              <button type="button" onClick={() => navigate("/calendar")} {...stylex.props(styles.ghost)}>Open calendar <ArrowRight size={12} /></button>
            </CardHeader>
            {upcoming.length === 0 ? <div {...stylex.props(styles.empty)}>Nothing scheduled in the next two weeks.</div> : upcoming.map((ev) => {
              const { m, d } = dayParts(ev.startOn!);
              return (
                <CardRow key={ev.id} onClick={() => navigate("/calendar")}>
                  <div {...stylex.props(styles.dateChip)}>
                    <div {...stylex.props(styles.dateM)}>{m}</div>
                    <div {...stylex.props(styles.dateD)}>{d}</div>
                  </div>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.evTitle)}>{ev.title}</div>
                    <div {...stylex.props(styles.small)}>{fmtDate(ev.startOn!)}{ev.category ? ` · ${ev.category}` : ""}</div>
                  </div>
                  {ev.source === "agent" && <AgentRibbon>{""}</AgentRibbon>}
                </CardRow>
              );
            })}
          </Card>

          {canReview && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses to approve</CardTitle>
                <button type="button" onClick={() => navigate("/finance")} {...stylex.props(styles.ghost)}>Finance <ArrowRight size={12} /></button>
              </CardHeader>
              {pend.length === 0 ? <div {...stylex.props(styles.empty)}>No expenses awaiting your approval.</div> : pend.map((e) => (
                <CardRow key={e.id} testId="dash-expense" onClick={() => navigate("/finance")}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.body135)}>{e.payee ?? "Expense"}</div>
                    <div {...stylex.props(styles.pillRow)}>
                      {e.deductible && <Pill>deductible</Pill>}
                      {e.vatReclaimable && <Pill>VAT reclaim</Pill>}
                    </div>
                  </div>
                  <div {...stylex.props(styles.amount)}>{fmtMoney(e.amountMinor, e.currency)}</div>
                </CardRow>
              ))}
            </Card>
          )}

          {canReview && (
            <Card>
              <CardHeader>
                <AgentRibbon>Awaiting you</AgentRibbon>
                <button type="button" onClick={() => navigate("/inbox")} {...stylex.props(styles.ghost)}>Open triage <ArrowRight size={12} /></button>
              </CardHeader>
              {triage.length === 0 ? <div {...stylex.props(styles.empty)}>The agent has nothing waiting for you.</div> : triage.slice(0, 5).map((a) => (
                <CardRow key={a.id} onClick={() => navigate("/inbox")}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.body135)}>{a.subject ?? a.actionType.replace(/_/g, " ")}</div>
                    <div {...stylex.props(styles.small)}>{[a.category, a.actionType.replace(/_/g, " ")].filter(Boolean).join(" · ")}</div>
                  </div>
                  <ChevronRight size={14} />
                </CardRow>
              ))}
            </Card>
          )}
        </div>

        {/* Right column */}
        <div {...stylex.props(styles.col)}>
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
              <button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.ghost)}>All <ArrowRight size={12} /></button>
            </CardHeader>
            {properties.map((p, i) => (
              <CardRow key={p.id} onClick={() => navigate("/properties")}>
                <div {...stylex.props(styles.cover, covers[i % covers.length])} />
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.evTitle)}>{p.name}</div>
                  <div {...stylex.props(styles.small)}>{p.jurisdiction ?? "—"}</div>
                </div>
                <ChevronRight size={14} />
              </CardRow>
            ))}
          </Card>

          {canReview && (
            <Card>
              <CardHeader><CardTitle>Expiring within 60 days</CardTitle></CardHeader>
              {expiring.length === 0 ? <div {...stylex.props(styles.empty)}>Nothing expiring soon.</div> : expiring.map((x) => (
                <CardRow key={x.id} testId="dash-expiring">
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.body135)}>{x.who}</div>
                    <div {...stylex.props(styles.small)}>{x.kind} · {fmtDate(x.until)}</div>
                  </div>
                  <Pill tone={x.days < 0 ? "danger" : x.days < 30 ? "warn" : "default"}>{x.days < 0 ? "Lapsed" : `${x.days}d`}</Pill>
                </CardRow>
              ))}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>This week's lists</CardTitle>
              <button type="button" onClick={() => navigate("/lists")} {...stylex.props(styles.ghost)}>Lists <ArrowRight size={12} /></button>
            </CardHeader>
            {weekLists.length === 0 ? <div {...stylex.props(styles.empty)}>No lists yet.</div> : weekLists.map((l) => (
              <DashListRow key={l.id} id={l.id} name={l.name} nextOrder={l.nextOrder} token={token} onClick={() => navigate("/lists")} />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

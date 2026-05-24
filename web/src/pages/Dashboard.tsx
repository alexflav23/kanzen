import * as stylex from "@stylexjs/stylex";
import { useNavigate } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { AgentRibbon } from "../components/AgentRibbon";
import { Bar } from "../components/Bar";
import { Pill } from "../components/Pill";
import { Plus, ChevronRight, ArrowRight, Box } from "../components/icons";
import { EXPENSES } from "../data/mockExpenses";
import {
  TODAY_EYEBROW, UPCOMING, BUDGETS, AGENT_HISTORY, EXPIRING, LISTS, CONNECTED, TRIAGE_COUNT,
  fmtMoney, fmtDate, fmtDayLong, dayParts, relativeTime,
} from "../data/mockDashboard";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "32px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  display: { fontSize: "36px", fontWeight: 600, letterSpacing: "-0.022em", color: colors.ink },
  sub: { color: colors.ink3, marginTop: "8px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  heroCard: { marginBottom: "32px" },
  heroGrid: { display: "grid", gridTemplateColumns: "1fr 1fr" },
  heroCell: { display: "flex", alignItems: "center", gap: "12px", padding: "22px 28px", borderWidth: 0, backgroundColor: "transparent", textAlign: "left", cursor: "pointer", color: colors.ink },
  heroDivider: { borderRightWidth: "1px", borderRightStyle: "solid", borderRightColor: colors.line },
  grow: { flex: 1 },
  rowGap8: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  h2: { fontSize: "20px", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: "4px" },
  small: { fontSize: "12.5px", color: colors.ink3 },
  body: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px", alignItems: "start" },
  col: { display: "flex", flexDirection: "column", gap: "24px" },
  ghost: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderWidth: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12.5px" },
  dateChip: { width: "48px", height: "48px", backgroundColor: colors.bgSunken, borderRadius: radius.md, display: "grid", placeItems: "center", textAlign: "center" },
  dateM: { fontSize: "10px", color: colors.ink3, letterSpacing: "0.08em" },
  dateD: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "-2px" },
  evTitle: { fontSize: "14px", fontWeight: 500 },
  budgetGrid: { padding: "22px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" },
  bName: { fontSize: "13px", color: colors.ink3, marginBottom: "2px" },
  bSpent: { fontSize: "22px", fontWeight: 600, letterSpacing: "-0.018em" },
  monthRow: { display: "flex", gap: "4px", marginTop: "12px" },
  cover: { width: "40px", height: "40px", borderRadius: radius.md },
  listIcon: { width: "36px", height: "36px", borderRadius: "10px", backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", color: colors.ink2 },
  connGrid: { padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  connItem: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", backgroundColor: colors.bgSunken, borderRadius: radius.md },
  greenDot: { width: "6px", height: "6px", borderRadius: "999px", backgroundColor: colors.positive },
  colorPill: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 10px", borderRadius: radius.sm, fontSize: "12px", fontWeight: 500 },
  spread: { display: "flex", alignItems: "flex-end", marginBottom: "10px" },
  rightText: { textAlign: "right" },
  janMay: { display: "flex", justifyContent: "space-between", marginTop: "6px" },
  hRow: { display: "flex", alignItems: "center", gap: "10px" },
  num: { fontVariantNumeric: "tabular-nums" },
  body135: { fontSize: "13.5px" },
  sparkTrack: { flex: 1, height: "24px", backgroundColor: colors.bgSunken, borderRadius: "4px", position: "relative", overflow: "hidden" },
  sparkFill: { position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: "4px", backgroundColor: colors.ink3 },
  sparkFillCurrent: { backgroundColor: colors.accent },
  coverWardian: { backgroundImage: "linear-gradient(135deg,#1B1F2E,#3B3F55)" },
  coverSingapore: { backgroundImage: "linear-gradient(135deg,#243B47,#3D6B7D)" },
  connName: { fontSize: "12.5px", fontWeight: 500 },
  tiny: { fontSize: "11px" },
});

export function Dashboard() {
  const navigate = useNavigate();
  const pending = EXPENSES.filter((e) => e.status === "pending");

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>{TODAY_EYEBROW}</div>
          <h1 {...stylex.props(styles.display)}>Good morning, Toby.</h1>
          <div {...stylex.props(styles.sub)}>
            {TRIAGE_COUNT} items awaiting your review, {pending.length} expenses for approval.
          </div>
        </div>
        <button type="button" {...stylex.props(styles.btn)}>
          <Plus size={14} /> Quick add
        </button>
      </header>

      {/* Attention strip */}
      <Card style={styles.heroCard}>
        <div {...stylex.props(styles.heroGrid)}>
          <button type="button" onClick={() => navigate("/soon")} {...stylex.props(styles.heroCell, styles.heroDivider)}>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.rowGap8)}>
                <AgentRibbon />
                <span {...stylex.props(styles.small)}>· 5 new since 06:00</span>
              </div>
              <div {...stylex.props(styles.h2)}>{TRIAGE_COUNT} items in Triage</div>
              <div {...stylex.props(styles.small)}>1 invoice with a +59% variance · 1 delivery · 2 appointments · 1 renewal</div>
            </div>
            <ChevronRight size={18} />
          </button>
          <button type="button" onClick={() => navigate("/finance")} {...stylex.props(styles.heroCell)}>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.rowGap8)}>
                <Pill tone="warn">Awaiting you</Pill>
              </div>
              <div {...stylex.props(styles.h2)}>{pending.length} expenses to approve</div>
              <div {...stylex.props(styles.small)}>
                {fmtMoney(184000, "GBP")} · HVAC quarterly · {fmtMoney(264000, "SGD")} · roof tile repair
              </div>
            </div>
            <ChevronRight size={18} />
          </button>
        </div>
      </Card>

      <div {...stylex.props(styles.body)}>
        {/* Left column */}
        <div {...stylex.props(styles.col)}>
          <Card>
            <CardHeader>
              <div {...stylex.props(styles.hRow)}>
                <CardTitle>Upcoming</CardTitle>
                <Pill>Next 14 days</Pill>
              </div>
              <button type="button" onClick={() => navigate("/soon")} {...stylex.props(styles.ghost)}>
                Open calendar <ArrowRight size={12} />
              </button>
            </CardHeader>
            {UPCOMING.map((ev) => {
              const { m, d } = dayParts(ev.date);
              return (
                <CardRow key={ev.id}>
                  <div {...stylex.props(styles.dateChip)}>
                    <div {...stylex.props(styles.dateM)}>{m}</div>
                    <div {...stylex.props(styles.dateD, styles.num)}>{d}</div>
                  </div>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.evTitle)}>{ev.title}</div>
                    <div {...stylex.props(styles.small)}>
                      {ev.time}{ev.property !== "—" && ` · ${ev.property}`}
                    </div>
                  </div>
                  <span {...stylex.props(styles.colorPill)} style={{ background: ev.color + "1A", color: ev.color }}>
                    {ev.category}
                  </span>
                  {ev.source === "agent" && <AgentRibbon>{""}</AgentRibbon>}
                </CardRow>
              );
            })}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This month · by property</CardTitle>
              <button type="button" onClick={() => navigate("/finance")} {...stylex.props(styles.ghost)}>
                Finance <ArrowRight size={12} />
              </button>
            </CardHeader>
            <div {...stylex.props(styles.budgetGrid)}>
              {BUDGETS.map((b) => {
                const pct = Math.round((b.spent / b.budget) * 100);
                return (
                  <div key={b.propertyId} data-testid="budget">
                    <div {...stylex.props(styles.spread)}>
                      <div>
                        <div {...stylex.props(styles.bName)}>{b.propertyName}</div>
                        <div {...stylex.props(styles.bSpent, styles.num)}>{fmtMoney(b.spent, b.currency)}</div>
                      </div>
                      <div {...stylex.props(styles.grow)} />
                      <div {...stylex.props(styles.rightText)}>
                        <div {...stylex.props(styles.small)}>of {fmtMoney(b.budget, b.currency)}</div>
                        <div {...stylex.props(styles.small)}>{pct}%</div>
                      </div>
                    </div>
                    <Bar pct={pct} />
                    <div {...stylex.props(styles.monthRow)}>
                      {b.periods.map((v, i) => (
                        <div key={i} {...stylex.props(styles.sparkTrack)}>
                          <div {...stylex.props(styles.sparkFill, i === 4 && styles.sparkFillCurrent)} style={{ height: `${v}%` }} />
                        </div>
                      ))}
                    </div>
                    <div {...stylex.props(styles.janMay)}>
                      <span {...stylex.props(styles.small)}>Jan</span>
                      <span {...stylex.props(styles.small)}>May</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <AgentRibbon>Agent activity</AgentRibbon>
              <button type="button" onClick={() => navigate("/soon")} {...stylex.props(styles.ghost)}>
                See all <ArrowRight size={12} />
              </button>
            </CardHeader>
            {AGENT_HISTORY.map((h) => (
              <CardRow key={h.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.body135)}>{h.title}</div>
                  <div {...stylex.props(styles.small)}>{h.category} · {h.action} · {h.outcome}</div>
                </div>
                <div {...stylex.props(styles.small)}>{relativeTime(h.at)}</div>
              </CardRow>
            ))}
          </Card>
        </div>

        {/* Right column */}
        <div {...stylex.props(styles.col)}>
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
              <button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.ghost)}>
                All <ArrowRight size={12} />
              </button>
            </CardHeader>
            <CardRow onClick={() => navigate("/properties")}>
              <div {...stylex.props(styles.cover, styles.coverWardian)} />
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.evTitle)}>Wardian, Apt 5206</div>
                <div {...stylex.props(styles.small)}>London E14</div>
              </div>
              <ChevronRight size={14} />
            </CardRow>
            <CardRow onClick={() => navigate("/properties")}>
              <div {...stylex.props(styles.cover, styles.coverSingapore)} />
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.evTitle)}>Singapore</div>
                <div {...stylex.props(styles.small)}>Marina Bay</div>
              </div>
              <ChevronRight size={14} />
            </CardRow>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expiring within 60 days</CardTitle>
            </CardHeader>
            {EXPIRING.map((x) => (
              <CardRow key={x.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.body135)}>{x.item}</div>
                  <div {...stylex.props(styles.small)}>{x.kind} · expires {fmtDate(x.until)}</div>
                </div>
                <Pill tone={x.lapsed ? "danger" : x.days < 45 ? "warn" : "default"}>
                  {x.lapsed ? "Lapsed" : `${x.days}d`}
                </Pill>
              </CardRow>
            ))}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This week's lists</CardTitle>
              <button type="button" onClick={() => navigate("/soon")} {...stylex.props(styles.ghost)}>
                Lists <ArrowRight size={12} />
              </button>
            </CardHeader>
            {LISTS.map((l) => (
              <CardRow key={l.id} onClick={() => navigate("/soon")}>
                <div {...stylex.props(styles.listIcon)}><Box size={15} /></div>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.evTitle)}>{l.name}</div>
                  <div {...stylex.props(styles.small)}>{l.total} items · orders {fmtDayLong(l.nextOrder)}</div>
                </div>
                {l.needsApproval > 0 && <Pill tone="warn">{l.needsApproval} to review</Pill>}
              </CardRow>
            ))}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connected systems</CardTitle>
            </CardHeader>
            <div {...stylex.props(styles.connGrid)}>
              {CONNECTED.map((s) => (
                <div key={s.name} {...stylex.props(styles.connItem)}>
                  <div>
                    <div {...stylex.props(styles.connName)}>{s.name}</div>
                    <div {...stylex.props(styles.small, styles.tiny)}>{s.status}</div>
                  </div>
                  <div {...stylex.props(styles.grow)} />
                  <span {...stylex.props(styles.greenDot)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

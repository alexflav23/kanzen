import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Alert, X, Check } from "../components/icons";
import { fmtMoney } from "../data/money";
import { EXPENSES, type MockExpense } from "../data/mockExpenses";
import { BILLS, PAY_QUEUE, daysUntil, fmtDate } from "../data/mockFinance";
import { BUDGETS } from "../data/mockDashboard";

type Tab = "bills" | "pay" | "expenses" | "budgets";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  strong: { color: colors.ink },
  seg: { display: "inline-flex", border: `1px solid ${colors.line}`, borderRadius: radius.sm, overflow: "hidden" },
  segBtn: { padding: "6px 12px", border: 0, background: "transparent", cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
  segActive: { backgroundColor: colors.accent, color: colors.accentInk },
  tabs: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px" },
  tab: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "24px" },
  stat: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "16px 18px" },
  statL: { fontSize: "12px", color: colors.ink3 },
  statN: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.022em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  statSub: { fontSize: "12px", color: colors.ink3, marginTop: "4px" },
  warn: { color: colors.warn },
  positive: { color: colors.positive },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px", verticalAlign: "top" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  sub: { fontSize: "12px", color: colors.ink3 },
  grow: { flex: 1 },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  btnAccent: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  amount: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  varianceCard: { display: "flex", alignItems: "stretch", marginTop: "24px", overflow: "hidden" },
  varianceBar: { width: "6px", backgroundColor: colors.warn },
  variancePad: { padding: "20px 24px", flex: 1 },
  rowGap8: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  h2: { fontSize: "18px", fontWeight: 600, marginBottom: "4px" },
  payRow: { display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px", borderBottom: `1px solid ${colors.line}` },
  dateChip: { width: "52px", textAlign: "center" },
  dateM: { fontSize: "10px", color: colors.ink3, letterSpacing: "0.08em" },
  dateD: { fontSize: "22px", fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1 },
  pendRow: { display: "flex", alignItems: "flex-start", gap: "12px", padding: "16px 20px", borderBottom: `1px solid ${colors.line}` },
  icoBox: { width: "44px", height: "44px", borderRadius: "10px", backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", color: colors.ink2, flexShrink: 0 },
  budgets: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  budgetCard: { padding: "24px" },
  bSpent: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.022em" },
  bar: { height: "6px", borderRadius: "999px", backgroundColor: colors.bgSunken, overflow: "hidden", marginTop: "10px" },
  barFill: { height: "100%", borderRadius: "999px", backgroundColor: colors.accent },
  months: { display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", marginTop: "28px" },
  monthCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  filters: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  bold: { fontWeight: 500 },
  narrow: { maxWidth: "580px" },
  mb3: { marginBottom: "3px" },
  pendDesc: { fontWeight: 500, fontSize: "14px" },
  right: { textAlign: "right" },
  amountLg: { fontSize: "17px" },
  flexEnd: { display: "flex", alignItems: "flex-end" },
  mt24: { marginTop: "24px" },
});

export function Finance() {
  const [tab, setTab] = useState<Tab>("bills");
  const [property, setProperty] = useState<"all" | "wardian" | "singapore">("all");
  const [payFilter, setPayFilter] = useState<"all" | "review" | "auto" | "manual">("all");
  const [expenses, setExpenses] = useState<MockExpense[]>(EXPENSES);
  const decide = (id: string, status: "approved" | "rejected") =>
    setExpenses((xs) => xs.map((e) => (e.id === id ? { ...e, status } : e)));

  const bills = BILLS.filter((b) => property === "all" || b.property === property);
  const shownExpenses = expenses.filter((e) => property === "all" || e.property.toLowerCase() === property);
  const pending = shownExpenses.filter((e) => e.status === "pending");
  const payShown = PAY_QUEUE.filter((p) => {
    if (payFilter === "auto") return p.auto;
    if (payFilter === "manual") return !p.auto && !p.varianceFlag;
    if (payFilter === "review") return p.varianceFlag || p.status === "Awaiting review";
    return true;
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Finance</div>
          <h1 {...stylex.props(styles.title)}>Bills, expenses &amp; budgets</h1>
          <div {...stylex.props(styles.desc)}>
            Recurring schedule, one-off transactions, and approvals.{" "}
            {pending.length > 0 && <span {...stylex.props(styles.strong)}>{pending.length} pending your approval.</span>}
          </div>
        </div>
        <div {...stylex.props(styles.seg)} role="tablist" aria-label="Property">
          {(["all", "wardian", "singapore"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={property === p} onClick={() => setProperty(p)} {...stylex.props(styles.segBtn, property === p && styles.segActive)}>
              {p === "all" ? "All" : p === "wardian" ? "Wardian" : "Singapore"}
            </button>
          ))}
        </div>
      </header>

      <div {...stylex.props(styles.tabs)} role="tablist" aria-label="Finance sections">
        {([
          ["bills", "Recurring bills", null],
          ["pay", "Pay queue", PAY_QUEUE.filter((p) => p.days <= 14).length],
          ["expenses", "Expenses", pending.length || null],
          ["budgets", "Budgets", null],
        ] as const).map(([id, label, badge]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id as Tab)} {...stylex.props(styles.tab, tab === id && styles.tabActive)}>
            {label}
            {badge ? <Pill tone={id === "expenses" ? "warn" : "accent"}>{badge}</Pill> : null}
          </button>
        ))}
      </div>

      {tab === "bills" && <BillsTab bills={bills} />}
      {tab === "pay" && <PayTab items={payShown} total={PAY_QUEUE.length} filter={payFilter} setFilter={setPayFilter} />}
      {tab === "expenses" && <ExpensesTab pending={pending} all={shownExpenses} decide={decide} />}
      {tab === "budgets" && <BudgetsTab />}
    </div>
  );

  function BillsTab({ bills }: { bills: typeof BILLS }) {
    const gbpDue = bills.filter((b) => b.currency === "GBP" && daysUntil(b.nextDue) < 30).reduce((s, b) => s + b.amountMinor, 0);
    const sgdDue = bills.filter((b) => b.currency === "SGD" && daysUntil(b.nextDue) < 30).reduce((s, b) => s + b.amountMinor, 0);
    const variances = bills.filter((b) => b.variancePct);
    const next7 = bills.filter((b) => daysUntil(b.nextDue) <= 7).length;
    return (
      <>
        <div {...stylex.props(styles.stats)}>
          <Stat label="Due this month" value={fmtMoney(gbpDue, "GBP")} sub="GBP recurring" />
          <Stat label="Due this month · SGD" value={fmtMoney(sgdDue, "SGD")} sub="Singapore" />
          <Stat label="Variance flagged" value={String(variances.length)} sub="From agent reconciliation" warn />
          <Stat label="Next 7 days" value={String(next7)} sub="Reminders scheduled" />
        </div>
        <Card>
          <CardHeader><CardTitle>Recurring schedule · {bills.length}</CardTitle><button type="button" {...stylex.props(styles.btn)}><Plus size={12} /> Add bill</button></CardHeader>
          <table {...stylex.props(styles.table)}>
            <thead><tr>
              <th {...stylex.props(styles.th)}>Payee</th><th {...stylex.props(styles.th)}>Category</th><th {...stylex.props(styles.th)}>Frequency</th>
              <th {...stylex.props(styles.th)}>Next due</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th>
            </tr></thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} data-testid="bill-row">
                  <td {...stylex.props(styles.td)}><div {...stylex.props(styles.bold)}>{b.payee}</div><div {...stylex.props(styles.sub)}>{b.method}</div></td>
                  <td {...stylex.props(styles.td)}><Pill>{b.category}</Pill></td>
                  <td {...stylex.props(styles.td)}>{b.freq}</td>
                  <td {...stylex.props(styles.td)}><div>{fmtDate(b.nextDue)}</div><div {...stylex.props(styles.sub)}>{daysUntil(b.nextDue) <= 0 ? "today" : `in ${daysUntil(b.nextDue)} days`}</div></td>
                  <td {...stylex.props(styles.td, styles.tdR)}>
                    <div {...stylex.props(styles.amount)}>{fmtMoney(b.amountMinor, b.currency)}</div>
                    {b.variancePct && <div {...stylex.props(styles.sub, styles.warn)}>+{b.variancePct}% vs prev</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {variances.length > 0 && (
          <Card style={styles.varianceCard}>
            <div {...stylex.props(styles.varianceBar)} />
            <div {...stylex.props(styles.variancePad)}>
              <div {...stylex.props(styles.rowGap8)}>
                <Pill tone="warn"><Alert size={11} /> Variance flag</Pill>
                <Pill tone="accent">from agent reconciliation</Pill>
              </div>
              <div {...stylex.props(styles.h2)}>SP Group · usage up 59.6%</div>
              <div {...stylex.props(styles.desc, styles.narrow)}>
                The May invoice for Singapore is S$613 versus S$384 last month. The agent saw this in the inbound statement and updated the next due date — but flagged it for you.
              </div>
            </div>
          </Card>
        )}
      </>
    );
  }
}

function Stat({ label, value, sub, warn, positive }: { label: string; value: string; sub: string; warn?: boolean; positive?: boolean }) {
  return (
    <div {...stylex.props(styles.stat)}>
      <div {...stylex.props(styles.statL)}>{label}</div>
      <div {...stylex.props(styles.statN, warn && styles.warn, positive && styles.positive)}>{value}</div>
      <div {...stylex.props(styles.statSub)}>{sub}</div>
    </div>
  );
}

function PayTab({ items, total, filter, setFilter }: { items: typeof PAY_QUEUE; total: number; filter: string; setFilter: (f: "all" | "review" | "auto" | "manual") => void }) {
  const gbp = PAY_QUEUE.filter((p) => p.currency === "GBP" && p.days <= 30).reduce((s, p) => s + p.amountMinor, 0);
  const sgd = PAY_QUEUE.filter((p) => p.currency === "SGD" && p.days <= 30).reduce((s, p) => s + p.amountMinor, 0);
  const autoCount = PAY_QUEUE.filter((p) => p.auto).length;
  const review = PAY_QUEUE.filter((p) => p.status === "Awaiting review").length;
  return (
    <>
      <div {...stylex.props(styles.stats)}>
        <Stat label="Due next 30 days · GBP" value={fmtMoney(gbp, "GBP")} sub={`${PAY_QUEUE.filter((p) => p.currency === "GBP" && p.days <= 30).length} bills`} />
        <Stat label="Due next 30 days · SGD" value={fmtMoney(sgd, "SGD")} sub={`${PAY_QUEUE.filter((p) => p.currency === "SGD" && p.days <= 30).length} bills`} />
        <Stat label="Auto-paid" value={String(autoCount)} sub="Direct Debit / GIRO / Card" positive />
        <Stat label="Awaiting your review" value={String(review)} sub="Inc. 1 variance" warn={review > 0} />
      </div>
      <div {...stylex.props(styles.filters)}>
        <div {...stylex.props(styles.seg)} role="tablist" aria-label="Pay filter">
          {(["all", "review", "auto", "manual"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} {...stylex.props(styles.segBtn, filter === f && styles.segActive)}>
              {f === "all" ? "All" : f === "review" ? "Needs review" : f === "auto" ? "Auto-paid" : "Manual"}
            </button>
          ))}
        </div>
        <span {...stylex.props(styles.grow)} />
        <span {...stylex.props(styles.sub)}>Showing {items.length} of {total}</span>
      </div>
      <Card>
        {items.map((p) => {
          const d = new Date(p.due);
          return (
            <div key={p.id} data-testid="pay-row" {...stylex.props(styles.payRow)}>
              <div {...stylex.props(styles.dateChip)}>
                <div {...stylex.props(styles.dateM)}>{d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
                <div {...stylex.props(styles.dateD)}>{d.getDate()}</div>
                <div {...stylex.props(styles.dateM)}>in {p.days}d</div>
              </div>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.rowGap8, styles.mb3)}>
                  <span {...stylex.props(styles.bold)}>{p.payee}</span>
                  {p.varianceFlag && <Pill tone="warn"><Alert size={11} /> Variance</Pill>}
                  {p.auto && <Pill tone="default">Auto</Pill>}
                </div>
                <div {...stylex.props(styles.sub)}>{p.property} · {p.category} · via {p.method}</div>
              </div>
              <div {...stylex.props(styles.amount)}>{fmtMoney(p.amountMinor, p.currency)}</div>
              {p.auto ? (
                <Pill tone="default"><Check size={11} /> Scheduled</Pill>
              ) : p.varianceFlag ? (
                <button type="button" {...stylex.props(styles.btn)}>Review</button>
              ) : (
                <button type="button" {...stylex.props(styles.btn)}><Check size={12} /> Mark paid</button>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}

function ExpensesTab({ pending, all, decide }: { pending: MockExpense[]; all: MockExpense[]; decide: (id: string, s: "approved" | "rejected") => void }) {
  return (
    <>
      {pending.length > 0 && (
        <Card>
          <CardHeader><Pill tone="warn">Awaiting your approval</Pill></CardHeader>
          {pending.map((e) => (
            <div key={e.id} data-testid="pending-row" {...stylex.props(styles.pendRow)}>
              <div {...stylex.props(styles.icoBox)}><Plus size={18} /></div>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.pendDesc)}>{e.description} · {e.payee}</div>
                <div {...stylex.props(styles.sub)}>{e.property} · {e.category} · {e.date} · requested by {e.requestedBy}</div>
              </div>
              <div {...stylex.props(styles.right)}>
                <div {...stylex.props(styles.amount, styles.amountLg)}>{fmtMoney(e.amountMinor, e.currency)}</div>
                <div {...stylex.props(styles.sub)}>Above £1,500 threshold</div>
              </div>
              <button type="button" onClick={() => decide(e.id, "rejected")} {...stylex.props(styles.btn)}><X size={14} /> Reject</button>
              <button type="button" onClick={() => decide(e.id, "approved")} {...stylex.props(styles.btn, styles.btnAccent)}><Check size={14} /> Approve</button>
            </div>
          ))}
        </Card>
      )}
      <div {...stylex.props(pending.length > 0 && styles.mt24)}>
        <Card>
          <CardHeader><CardTitle>All expenses</CardTitle><button type="button" {...stylex.props(styles.btn)}><Plus size={12} /> Log expense</button></CardHeader>
          {pending.length === 0 && <CardRow><span {...stylex.props(styles.sub)}>Nothing awaiting approval.</span></CardRow>}
          <table {...stylex.props(styles.table)}>
            <thead><tr>
              <th {...stylex.props(styles.th)}>Date</th><th {...stylex.props(styles.th)}>Description</th><th {...stylex.props(styles.th)}>Category</th>
              <th {...stylex.props(styles.th)}>Status</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th>
            </tr></thead>
            <tbody>
              {all.map((e) => (
                <tr key={e.id} data-testid="expense-row">
                  <td {...stylex.props(styles.td)}>{e.date}</td>
                  <td {...stylex.props(styles.td)}><div {...stylex.props(styles.bold)}>{e.description}</div><div {...stylex.props(styles.sub)}>{e.payee}</div></td>
                  <td {...stylex.props(styles.td)}><Pill>{e.category}</Pill></td>
                  <td {...stylex.props(styles.td)}>
                    {e.status === "approved" && <Pill tone="default"><Check size={11} /> Approved</Pill>}
                    {e.status === "pending" && <Pill tone="warn">Pending</Pill>}
                    {e.status === "rejected" && <Pill tone="danger">Rejected</Pill>}
                  </td>
                  <td {...stylex.props(styles.td, styles.tdR, styles.amount)}>{fmtMoney(e.amountMinor, e.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function BudgetsTab() {
  return (
    <div {...stylex.props(styles.budgets)}>
      {BUDGETS.map((b) => {
        const pct = Math.round((b.spent / b.budget) * 100);
        return (
          <Card key={b.propertyId} style={styles.budgetCard}>
            <div {...stylex.props(styles.eyebrow)}>{b.propertyName} · 2026</div>
            <div {...stylex.props(styles.flexEnd)}>
              <div>
                <div {...stylex.props(styles.bSpent)}>{fmtMoney(b.spent, b.currency)}</div>
                <div {...stylex.props(styles.sub)}>of {fmtMoney(b.budget, b.currency)} annual</div>
              </div>
              <span {...stylex.props(styles.grow)} />
              <Pill tone="accent">{pct}% used</Pill>
            </div>
            <div {...stylex.props(styles.bar)}><div {...stylex.props(styles.barFill)} style={{ width: `${pct}%` }} /></div>
            <div {...stylex.props(styles.months)}>
              {["Jan", "Feb", "Mar", "Apr", "May"].map((m, i) => (
                <div key={m} {...stylex.props(styles.monthCol)}>
                  <div style={{ width: "100%", height: `${b.periods[i]}%`, background: i === 4 ? colors.accent : colors.ink3, borderRadius: 6 }} />
                  <div {...stylex.props(styles.sub)}>{m}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Finance — bills schedule, expenses, approvals
function Finance({ onApprove, onReject }) {
  const [tab, setTab] = React.useState("bills");
  const [property, setProperty] = React.useState("all");
  const [currency, setCurrency] = React.useState("native");

  const bills = window.DATA.bills.filter(b => property === "all" || b.property === property);
  const expenses = window.DATA.expenses.filter(e => property === "all" || e.property === property);
  const totalPending = expenses.filter(e => e.status === "Pending Approval").length;

  return (
    <div className="page fade-in">
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Finance</div>
          <div className="t-title">Bills, expenses & budgets</div>
          <div className="muted t-body" style={{ marginTop: 6 }}>
            Recurring schedule, one-off transactions, and approvals.
            {totalPending > 0 && <> <span style={{ color: "var(--ink)" }}>{totalPending} pending your approval.</span></>}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="segmented">
            <button className={property === "all" ? "active" : ""} onClick={() => setProperty("all")}>All</button>
            <button className={property === "wardian" ? "active" : ""} onClick={() => setProperty("wardian")}>Wardian</button>
            <button className={property === "singapore" ? "active" : ""} onClick={() => setProperty("singapore")}>Singapore</button>
          </div>
          <div className="segmented">
            <button className={currency === "native" ? "active" : ""} onClick={() => setCurrency("native")}>Native</button>
            <button className={currency === "gbp" ? "active" : ""} onClick={() => setCurrency("gbp")}>£ only</button>
          </div>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "bills" ? "active" : ""} onClick={() => setTab("bills")}>Recurring bills</button>
        <button className={tab === "pay" ? "active" : ""} onClick={() => setTab("pay")}>
          Pay queue <span className="pill pill-accent" style={{ marginLeft: 6, height: 18, padding: "0 6px", fontSize: 11 }}>{window.DATA.payQueue.filter(p => p.days <= 14).length}</span>
        </button>
        <button className={tab === "expenses" ? "active" : ""} onClick={() => setTab("expenses")}>
          Expenses {totalPending > 0 && <span className="pill pill-warn" style={{ marginLeft: 6, height: 18, padding: "0 6px", fontSize: 11 }}>{totalPending}</span>}
        </button>
        <button className={tab === "methods" ? "active" : ""} onClick={() => setTab("methods")}>Payment methods</button>
        <button className={tab === "budgets" ? "active" : ""} onClick={() => setTab("budgets")}>Budgets</button>
      </div>

      {tab === "bills" && (
        <>
          {/* Summary strip */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            {[
              { label: "Due this month", v: "£" + bills.filter(b => b.currency === "GBP" && window.daysUntil(b.nextDue) < 30).reduce((s, b) => s + b.amount, 0).toFixed(0), sub: "Wardian + GBP recurring" },
              { label: "Due this month · SGD", v: "S$" + bills.filter(b => b.currency === "SGD" && window.daysUntil(b.nextDue) < 30).reduce((s, b) => s + b.amount, 0).toFixed(0), sub: "Singapore" },
              { label: "Variance flagged", v: bills.filter(b => b.variance).length, sub: "From agent reconciliation", warn: true },
              { label: "Next 7 days", v: bills.filter(b => window.daysUntil(b.nextDue) <= 7).length, sub: "Reminders scheduled" },
            ].map(s => (
              <div key={s.label} className="card card-pad">
                <div className="t-small">{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4, color: s.warn ? "var(--warn)" : "var(--ink)" }}>{s.v}</div>
                <div className="t-small" style={{ marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recurring schedule · {bills.length}</span>
              <button className="btn btn-sm"><window.I.Plus size={12}/> Add bill</button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Payee</th><th>Category</th><th>Property</th><th>Frequency</th>
                  <th>Next due</th><th style={{textAlign:"right"}}>Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const days = window.daysUntil(b.nextDue);
                  const prop = window.DATA.properties.find(p => p.id === b.property);
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.payee}</div>
                        <div className="muted t-small">{b.method}</div>
                      </td>
                      <td><span className="pill">{b.category}</span></td>
                      <td>{prop?.name}</td>
                      <td>{b.freq}</td>
                      <td>
                        <div>{window.fmtDate(b.nextDue)}</div>
                        <div className={"t-small " + (days < 7 ? "" : "")}>
                          {days <= 0 ? "today" : "in " + days + " days"}
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 500 }}>{window.fmtMoney(b.amount, b.currency)}</div>
                        {b.variance && (
                          <div className="t-small" style={{ color: "var(--warn)" }}>
                            +{Math.round(((b.lastSeen - b.prevSeen) / b.prevSeen) * 100)}% vs prev
                          </div>
                        )}
                      </td>
                      <td style={{ width: 1, paddingRight: 16 }}>
                        {b.variance && <span className="pill pill-warn"><window.I.Alert size={11}/>Variance</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Variance detail strip */}
          {bills.some(b => b.variance) && (
            <div className="card" style={{ marginTop: 24, padding: 0 }}>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{
                  width: 6, background: "var(--warn)",
                  borderTopLeftRadius: "var(--r-lg)", borderBottomLeftRadius: "var(--r-lg)"
                }}/>
                <div style={{ padding: "20px 24px", flex: 1 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="pill pill-warn"><window.I.Alert size={11}/>Variance flag</span>
                    <span className="agent-ribbon"><span className="agent-glyph"></span> from agent reconciliation</span>
                  </div>
                  <div className="t-h2" style={{ marginBottom: 4 }}>SP Group · usage up 59.6%</div>
                  <div className="muted t-body" style={{ marginBottom: 16, maxWidth: 580 }}>
                    The May invoice for Singapore is S$612.80 versus S$384.20 last month. Agent saw this in the inbound statement and updated the next due date — but flagged it for you.
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn">View statement</button>
                    <button className="btn">Open Triage item</button>
                    <button className="btn btn-ghost">Acknowledge</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "expenses" && (
        <>
          {expenses.filter(e => e.status === "Pending Approval").length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill pill-warn"><span className="pill-dot"></span>Awaiting your approval</span>
                </div>
              </div>
              {expenses.filter(e => e.status === "Pending Approval").map(e => {
                const prop = window.DATA.properties.find(p => p.id === e.property);
                return (
                  <div key={e.id} className="card-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
                      <window.I.Receipt size={18}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{e.desc}</span>
                        <span className="muted t-small">·  {e.payee}</span>
                      </div>
                      <div className="muted t-small">
                        {prop?.name}<span className="dot-sep"></span>{e.category}<span className="dot-sep"></span>{window.fmtDate(e.date)}<span className="dot-sep"></span>requested by {e.requested}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em" }}>
                        {window.fmtMoney(e.amount, e.currency)}
                      </div>
                      <div className="muted t-small">Above £1,500 threshold</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn" onClick={() => onReject?.(e)}><window.I.X size={14}/>Reject</button>
                      <button className="btn btn-accent" onClick={() => onApprove?.(e)}><window.I.Check size={14}/>Approve</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">All expenses</span>
              <button className="btn btn-sm"><window.I.Plus size={12}/> Log expense</button>
            </div>
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Property</th><th>Category</th><th>Status</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
              <tbody>
                {expenses.map(e => {
                  const prop = window.DATA.properties.find(p => p.id === e.property);
                  return (
                    <tr key={e.id}>
                      <td>{window.fmtDate(e.date)}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{e.desc}</div>
                        <div className="muted t-small">{e.payee}</div>
                      </td>
                      <td>{prop?.name}</td>
                      <td><span className="pill">{e.category}</span></td>
                      <td>
                        {e.status === "Approved" && <span className="pill pill-positive"><window.I.Check size={11}/>Approved</span>}
                        {e.status === "Pending Approval" && <span className="pill pill-warn">Pending</span>}
                      </td>
                      <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>{window.fmtMoney(e.amount, e.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "pay" && (
        <PayQueue />
      )}

      {tab === "methods" && (
        <PaymentMethods />
      )}

      {tab === "budgets" && (
        <div className="grid-2" style={{ gap: 24 }}>
          {Object.entries(window.DATA.budgets).map(([pid, b]) => {
            const prop = window.DATA.properties.find(p => p.id === pid);
            const pct = Math.round((b.spent / b.budget) * 100);
            return (
              <section key={pid} className="card card-pad-lg">
                <div className="t-eyebrow" style={{ marginBottom: 16 }}>{prop.name} · 2026</div>
                <div className="row" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em" }}>{window.fmtMoney(b.spent, b.currency)}</div>
                    <div className="muted t-small">of {window.fmtMoney(b.budget, b.currency)} annual</div>
                  </div>
                  <div className="spacer"></div>
                  <span className="pill pill-accent">{pct}% used</span>
                </div>
                <div className="bar"><i style={{ width: pct + "%" }}/></div>
                <div className="row" style={{ marginTop: 28, gap: 6, alignItems: "flex-end", height: 120 }}>
                  {["Jan","Feb","Mar","Apr","May"].map((m, i) => (
                    <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: "100%",
                        height: b.periods[i] + "%",
                        background: i === 4 ? "var(--accent)" : "var(--ink-5)",
                        borderRadius: 6,
                        transition: "height .6s var(--ease-out)",
                      }}/>
                      <div className="t-small">{m}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

window.Finance = Finance;

function PayQueue() {
  const [filter, setFilter] = React.useState("all"); // all | auto | manual | review
  const q = window.DATA.payQueue;
  const filtered = q.filter(p => {
    if (filter === "auto") return p.auto;
    if (filter === "manual") return !p.auto && !p.varianceFlag;
    if (filter === "review") return p.varianceFlag || p.status === "Awaiting review";
    return true;
  });
  const methodOf = (id) => window.DATA.paymentMethods.find(m => m.id === id);

  const totalGBP = q.filter(p => p.currency === "GBP" && p.days <= 30).reduce((s, p) => s + p.amount, 0);
  const totalSGD = q.filter(p => p.currency === "SGD" && p.days <= 30).reduce((s, p) => s + p.amount, 0);
  const reviewCount = q.filter(p => p.status === "Awaiting review").length;

  return (
    <>
      <div className="grid-4" style={{ marginBottom: 22 }}>
        <div className="card card-pad">
          <div className="t-small">Due next 30 days · GBP</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }}>{window.fmtMoney(totalGBP, "GBP")}</div>
          <div className="t-small" style={{ marginTop: 4 }}>{q.filter(p => p.currency === "GBP" && p.days <= 30).length} bills</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Due next 30 days · SGD</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }}>{window.fmtMoney(totalSGD, "SGD")}</div>
          <div className="t-small" style={{ marginTop: 4 }}>{q.filter(p => p.currency === "SGD" && p.days <= 30).length} bills</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Auto-paid</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4, color: "var(--positive)" }}>{q.filter(p => p.auto).length}</div>
          <div className="t-small" style={{ marginTop: 4 }}>Direct Debit / GIRO / Card</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Awaiting your review</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4, color: reviewCount ? "var(--warn)" : "var(--ink)" }}>{reviewCount}</div>
          <div className="t-small" style={{ marginTop: 4 }}>Inc. 1 variance</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <div className="segmented">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "review" ? "active" : ""} onClick={() => setFilter("review")}>Needs review</button>
          <button className={filter === "auto" ? "active" : ""} onClick={() => setFilter("auto")}>Auto-paid</button>
          <button className={filter === "manual" ? "active" : ""} onClick={() => setFilter("manual")}>Manual</button>
        </div>
        <span className="spacer"></span>
        <span className="t-small">Showing {filtered.length} of {q.length}</span>
      </div>

      {/* Timeline-grouped list */}
      <div className="card" style={{ padding: 0 }}>
        {filtered.map((p, i) => {
          const m = methodOf(p.method);
          const bill = window.DATA.bills.find(b => b.id === p.billId);
          const prop = window.DATA.properties.find(pp => pp.id === bill?.property);
          return (
            <div key={p.id} className="card-row" style={{ alignItems: "center", padding: "16px 20px" }}>
              <div style={{ width: 56, textAlign: "center" }}>
                <div className="t-small" style={{ fontSize: 10 }}>{new Date(p.due).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1 }}>{new Date(p.due).getDate()}</div>
                <div className="t-small" style={{ fontSize: 10, marginTop: 2 }}>in {p.days}d</div>
              </div>
              <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)", marginRight: 4 }}/>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 500 }}>{p.payee}</span>
                  {p.varianceFlag && <span className="pill pill-warn"><window.I.Alert size={11}/>Variance</span>}
                  {p.auto && <span className="pill pill-positive"><span className="pill-dot"></span>Auto</span>}
                </div>
                <div className="muted t-small">
                  {prop?.name}<span className="dot-sep"></span>{bill?.category}<span className="dot-sep"></span>via {m?.name}{m?.last4 && <> ·· {m.last4}</>}
                </div>
              </div>
              <div className="num" style={{ fontWeight: 500, fontSize: 15 }}>{window.fmtMoney(p.amount, p.currency)}</div>
              {p.auto ? (
                <span className="pill" style={{ width: 130, justifyContent: "center" }}><window.I.Check size={11}/>Scheduled</span>
              ) : p.varianceFlag ? (
                <button className="btn btn-sm" style={{ width: 130 }}>Review</button>
              ) : (
                <button className="btn btn-sm" style={{ width: 130 }}><window.I.Check size={12}/>Mark paid</button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PaymentMethods() {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid-2" style={{ gap: 16 }}>
        {window.DATA.paymentMethods.map(m => {
          const isCard = m.type === "Credit card";
          const isMulti = m.currency === "Multi";
          return (
            <div key={m.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "22px 24px 28px",
                background: isCard
                  ? "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #334155 100%)"
                  : isMulti
                    ? "linear-gradient(135deg, #1F2937 0%, #374151 100%)"
                    : "linear-gradient(135deg, var(--bg-elev) 0%, var(--bg-sunken) 100%)",
                color: isCard || isMulti ? "#fff" : "var(--ink)",
                position: "relative",
              }}>
                <div className="row" style={{ marginBottom: 32 }}>
                  <span style={{
                    fontSize: 11.5, letterSpacing: "0.06em", fontWeight: 500,
                    opacity: isCard || isMulti ? 0.7 : 1,
                    color: isCard || isMulti ? "#fff" : "var(--ink-3)",
                  }}>
                    {m.type.toUpperCase()}
                  </span>
                  <span className="spacer"></span>
                  <span className="pill" style={{
                    background: m.status === "Active" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.08)",
                    color: "#fff",
                    border: 0,
                  }}>
                    <span className="pill-dot" style={{ background: m.status === "Active" ? "#4ADE80" : "#FBBF24" }}></span>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.012em", marginBottom: 6 }}>
                  {m.name}
                </div>
                <div className="row" style={{ gap: 12, fontFamily: "var(--font-mono)", fontSize: 13, opacity: isCard || isMulti ? 0.85 : 1 }}>
                  <span>···· ···· ···· {m.last4}</span>
                  <span className="spacer"></span>
                  {m.expires && <span>exp {m.expires}</span>}
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="t-small">Holder</span>
                  <span className="spacer"></span>
                  <span style={{ fontSize: 12.5 }}>{m.owner}</span>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="t-small">Currency</span>
                  <span className="spacer"></span>
                  <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)" }}>{m.currency}</span>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="t-small">Used by</span>
                  <span className="spacer"></span>
                  <span style={{ fontSize: 12.5 }}>{m.usedFor} bills / expenses</span>
                </div>
                {m.note && (
                  <div className="t-small" style={{ marginTop: 10, padding: "8px 10px", background: "var(--bg-sunken)", borderRadius: 6 }}>{m.note}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card card-pad">
        <div className="row">
          <window.I.Lock size={16} style={{ color: "var(--ink-3)" }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Card numbers and credentials live in 1Password.</div>
            <div className="muted t-small">Kanzen stores only the display name, last 4, expiry and assignment. Tap a card to open its vault entry.</div>
          </div>
          <button className="btn btn-sm"><window.I.Plus size={12}/>Add method</button>
        </div>
      </div>
    </div>
  );
}

window.PayQueue = PayQueue;
window.PaymentMethods = PaymentMethods;

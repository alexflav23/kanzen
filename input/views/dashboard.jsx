// Dashboard view — calm overview for the Principal
function Dashboard({ onNav, onOpenTriage }) {
  const { triage, agentHistory, expiringSoon, upcomingEvents, expenses, budgets, lists } = window.DATA;
  const pendingApprovals = expenses.filter(e => e.status === "Pending Approval");
  const pendingTriage = triage.length;
  const listApprovals = lists.reduce((s, l) => s + l.items.filter(i => i.status === "needs_approval").length, 0);

  return (
    <div className="page fade-in">
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Friday · 22 May 2026</div>
          <div className="t-display">Good morning, Toby.</div>
          <div className="muted t-body" style={{ marginTop: 8 }}>
            {pendingTriage} item{pendingTriage === 1 ? "" : "s"} awaiting your review,{" "}
            {pendingApprovals.length} expense{pendingApprovals.length === 1 ? "" : "s"} for approval.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn">
            <window.I.Plus size={14}/> Quick add
          </button>
        </div>
      </header>

      {/* Hero attention strip */}
      {(pendingTriage > 0 || pendingApprovals.length > 0) && (
        <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--line)" }}>
            <button
              onClick={onOpenTriage}
              className="card-row clickable"
              style={{ border: 0, borderRight: "1px solid var(--line)", background: "transparent", textAlign: "left", padding: "22px 28px" }}>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="agent-ribbon">
                    <span className="agent-glyph"></span> Agent
                  </span>
                  <span className="muted t-small">·  5 new since 06:00</span>
                </div>
                <div className="t-h2" style={{ marginBottom: 4 }}>{pendingTriage} items in Triage</div>
                <div className="muted t-small">1 invoice with a +59% variance · 1 delivery · 2 appointments · 1 renewal</div>
              </div>
              <window.I.ChevronRight size={18}/>
            </button>
            <button
              onClick={() => onNav("finance")}
              className="card-row clickable"
              style={{ border: 0, background: "transparent", textAlign: "left", padding: "22px 28px" }}>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="pill pill-warn"><span className="pill-dot"></span>Awaiting you</span>
                </div>
                <div className="t-h2" style={{ marginBottom: 4 }}>{pendingApprovals.length} expenses to approve</div>
                <div className="muted t-small">
                  £1,840.00 · HVAC quarterly · S$2,640 · roof tile repair
                </div>
              </div>
              <window.I.ChevronRight size={18}/>
            </button>
          </div>
        </div>
      )}

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28 }}>
        {/* Left column */}
        <div className="col" style={{ gap: 24 }}>
          {/* Upcoming */}
          <section className="card">
            <div className="card-header">
              <div className="row" style={{ gap: 10 }}>
                <span className="card-title">Upcoming</span>
                <span className="pill">Next 14 days</span>
              </div>
              <button className="btn-ghost btn btn-sm" onClick={() => onNav("calendar")}>Open calendar <window.I.Arrow size={12}/></button>
            </div>
            {upcomingEvents.slice(0, 5).map(ev => {
              const d = new Date(ev.date);
              const dayN = d.getDate();
              const dayM = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
              return (
                <div className="card-row clickable" key={ev.id}>
                  <div style={{
                    width: 48, height: 48,
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--r-md)",
                    display: "grid", placeItems: "center",
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: ".08em" }}>{dayM}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: -2, letterSpacing: "-0.02em" }}>{dayN}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ev.title}</div>
                    <div className="muted t-small">
                      {ev.time}
                      {ev.property !== "—" && <><span className="dot-sep"></span>{ev.property}</>}
                    </div>
                  </div>
                  <span className="pill" style={{ background: ev.color + "1A", color: ev.color }}>
                    <span className="pill-dot" style={{ background: ev.color }}></span>{ev.category}
                  </span>
                  {ev.source === "agent" && (
                    <span className="agent-ribbon" title="Created by the email agent">
                      <span className="agent-glyph"></span>
                    </span>
                  )}
                </div>
              );
            })}
          </section>

          {/* Spend & budgets */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">This month · by property</span>
              <button className="btn-ghost btn btn-sm" onClick={() => onNav("finance")}>Finance <window.I.Arrow size={12}/></button>
            </div>
            <div style={{ padding: "22px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
              {Object.entries(budgets).map(([pid, b]) => {
                const pct = Math.round((b.spent / b.budget) * 100);
                const prop = window.DATA.properties.find(p => p.id === pid);
                return (
                  <div key={pid}>
                    <div className="row" style={{ marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 2 }}>{prop.name}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em" }}>
                          {window.fmtMoney(b.spent, b.currency)}
                        </div>
                      </div>
                      <div className="spacer"></div>
                      <div style={{ textAlign: "right" }}>
                        <div className="t-small" style={{ color: "var(--ink-3)" }}>of {window.fmtMoney(b.budget, b.currency)}</div>
                        <div className="t-small">{pct}%</div>
                      </div>
                    </div>
                    <div className="bar"><i style={{ width: pct + "%" }}/></div>
                    <div className="row" style={{ marginTop: 12, gap: 4 }}>
                      {b.periods.map((v, i) => (
                        <div key={i} style={{
                          flex: 1,
                          height: 24,
                          background: "var(--bg-sunken)",
                          borderRadius: 4,
                          position: "relative",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            position: "absolute",
                            bottom: 0, left: 0, right: 0,
                            height: v + "%",
                            background: i === 4 ? "var(--accent)" : "var(--ink-5)",
                            borderRadius: 4,
                            transition: "height .6s var(--ease-out)"
                          }}/>
                        </div>
                      ))}
                    </div>
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="t-small">Jan</span>
                      <span className="spacer"></span>
                      <span className="t-small">May</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent agent activity */}
          <section className="card">
            <div className="card-header">
              <div className="row" style={{ gap: 8 }}>
                <span className="agent-ribbon"><span className="agent-glyph"></span> Agent activity</span>
              </div>
              <button className="btn-ghost btn btn-sm" onClick={onOpenTriage}>See all <window.I.Arrow size={12}/></button>
            </div>
            {agentHistory.slice(0, 4).map(h => (
              <div className="card-row" key={h.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}>{h.title}</div>
                  <div className="muted t-small">
                    {h.category}<span className="dot-sep"></span>{h.action}<span className="dot-sep"></span>{h.outcome}
                  </div>
                </div>
                <div className="t-small">{window.relativeTime(h.at)}</div>
              </div>
            ))}
          </section>
        </div>

        {/* Right column */}
        <div className="col" style={{ gap: 24 }}>
          {/* Properties summary */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">Properties</span>
              <button className="btn-ghost btn btn-sm" onClick={() => onNav("properties")}>All <window.I.Arrow size={12}/></button>
            </div>
            {window.DATA.properties.map(p => (
              <div key={p.id} className="card-row clickable" onClick={() => onNav("property:" + p.id)}>
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--r-md)",
                  background: p.cover === "wardian"
                    ? "linear-gradient(135deg, #1B1F2E, #3B3F55)"
                    : "linear-gradient(135deg, #243B47, #3D6B7D)"
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div className="muted t-small">{p.address}</div>
                </div>
                <window.I.ChevronRight size={14}/>
              </div>
            ))}
          </section>

          {/* Expiring soon */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">Expiring within 60 days</span>
            </div>
            {expiringSoon.map(x => (
              <div className="card-row" key={x.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}>{x.item}</div>
                  <div className="muted t-small">{x.kind}<span className="dot-sep"></span>expires {window.fmtDate(x.until)}</div>
                </div>
                <span className={"pill " + (x.lapsed ? "pill-danger" : (x.days < 45 ? "pill-warn" : ""))}>
                  {x.lapsed ? "Lapsed" : x.days + "d"}
                </span>
              </div>
            ))}
          </section>

          {/* Quick links */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">This week's lists</span>
              <button className="btn-ghost btn btn-sm" onClick={() => onNav("lists")}>Lists <window.I.Arrow size={12}/></button>
            </div>
            {lists.slice(0, 3).map(l => {
              const needs = l.items.filter(i => i.status === "needs_approval").length;
              const total = l.items.length;
              return (
                <div key={l.id} className="card-row clickable" onClick={() => onNav("lists")}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
                    <window.I.Box size={15}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{l.name}</div>
                    <div className="muted t-small">{total} items<span className="dot-sep"></span>orders {window.fmtDayLong(l.nextOrder)}</div>
                  </div>
                  {needs > 0 && <span className="pill pill-warn">{needs} to review</span>}
                </div>
              );
            })}
          </section>

          {/* Connected systems */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">Connected systems</span>
            </div>
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { name: "Todoist", icon: "Todoist", status: "Connected" },
                { name: "Gmail", icon: "Gmail", status: "5 mailboxes" },
                { name: "Calendar", icon: "Calendar", status: "household" },
                { name: "Drive", icon: "Drive", status: "2 shared" },
              ].map(s => {
                const Ico = window.I[s.icon];
                return (
                  <div key={s.name} className="row" style={{
                    padding: "10px 12px",
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--r-md)",
                    gap: 10,
                  }}>
                    <Ico size={16}/>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
                      <div className="t-small" style={{ fontSize: 11 }}>{s.status}</div>
                    </div>
                    <div className="spacer"></div>
                    <span className="pill-dot" style={{ background: "var(--positive)", width: 6, height: 6, display: "inline-block", borderRadius: 999 }}/>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;

// Mobile parity — two screens that mirror the design language
function MobileView() {
  return (
    <div className="mobile-stage hide-scroll" style={{ background: "var(--bg-sunken)", minHeight: "100%" }}>
      <Iphone label="Dashboard — on the go">
        <MobileDashboard />
      </Iphone>
      <Iphone label="Triage — confirm a proposal">
        <MobileTriage />
      </Iphone>
    </div>
  );
}

function Iphone({ children, label }) {
  return (
    <div>
      <div className="t-small" style={{ textAlign: "center", marginBottom: 12, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </div>
      <div className="iphone">
        <div className="screen">
          <div className="notch"></div>
          <div style={{ paddingTop: 54, height: "100%", overflow: "auto" }} className="hide-scroll">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStatusBar() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      padding: "16px 30px 0",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 14, fontWeight: 600, color: "var(--ink)",
      zIndex: 4,
    }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <svg width="18" height="10" viewBox="0 0 18 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="1"/><rect x="5" y="4" width="3" height="6" rx="1"/><rect x="10" y="2" width="3" height="8" rx="1"/><rect x="15" y="0" width="3" height="10" rx="1"/></svg>
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="18" height="8" rx="2"/><rect x="2.5" y="2.5" width="15" height="5" rx="1" fill="currentColor"/></svg>
      </span>
    </div>
  );
}

function MobileDashboard() {
  const { triage, expenses, upcomingEvents } = window.DATA;
  const pending = expenses.filter(e => e.status === "Pending Approval");
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 80px" }}>
        <div className="t-eyebrow" style={{ marginBottom: 4 }}>Fri 22 May</div>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em", marginBottom: 4 }}>Good morning</div>
        <div className="muted t-small" style={{ marginBottom: 20 }}>
          {triage.length} in Triage · {pending.length} to approve
        </div>

        {/* Cards stack */}
        <div className="col" style={{ gap: 12, marginBottom: 24 }}>
          <button style={{
            width: "100%",
            textAlign: "left",
            border: 0,
            background: "var(--bg-elev)",
            borderRadius: "var(--r-lg)",
            padding: 18,
            boxShadow: "var(--shadow-1)",
          }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="agent-ribbon"><span className="agent-glyph"></span>Agent</span>
              <span className="spacer"></span>
              <window.I.ChevronRight size={14}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", marginBottom: 2 }}>5 items in Triage</div>
            <div className="muted t-small">1 variance flag · 2 appointments · 1 delivery · 1 renewal</div>
          </button>

          <button style={{
            width: "100%",
            textAlign: "left",
            border: 0,
            background: "var(--bg-elev)",
            borderRadius: "var(--r-lg)",
            padding: 18,
            boxShadow: "var(--shadow-1)",
          }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="pill pill-warn">2 awaiting approval</span>
              <span className="spacer"></span>
              <window.I.ChevronRight size={14}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", marginBottom: 2 }}>£1,840 · S$2,640</div>
            <div className="muted t-small">HVAC service · roof repair</div>
          </button>
        </div>

        <div className="t-eyebrow" style={{ marginBottom: 10 }}>Upcoming</div>
        <div className="col" style={{ gap: 8 }}>
          {upcomingEvents.slice(0, 4).map(ev => {
            const d = new Date(ev.date);
            return (
              <div key={ev.id} className="row" style={{
                padding: "12px 14px",
                background: "var(--bg-elev)",
                borderRadius: "var(--r-md)",
                gap: 12,
              }}>
                <div style={{ textAlign: "center", width: 36 }}>
                  <div className="t-small" style={{ fontSize: 10 }}>{d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.012em" }}>{d.getDate()}</div>
                </div>
                <div style={{
                  width: 3, height: 32, background: ev.color, borderRadius: 2,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                  <div className="muted t-small">{ev.time}{ev.property !== "—" && <><span className="dot-sep"></span>{ev.property}</>}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        position: "absolute", bottom: 12, left: 12, right: 12,
        background: "var(--bg-overlay)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--line)",
        borderRadius: 22,
        padding: "10px 16px",
        display: "flex", justifyContent: "space-around",
      }}>
        {[
          { icon: "Dashboard", active: true, label: "Home" },
          { icon: "Triage", label: "Triage" },
          { icon: "Property", label: "Bibles" },
          { icon: "Finance", label: "Money" },
          { icon: "Search", label: "Search" },
        ].map((t, i) => {
          const Ico = window.I[t.icon];
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: t.active ? "var(--accent)" : "var(--ink-3)",
            }}>
              <Ico size={18}/>
              <span style={{ fontSize: 9.5, fontWeight: 500 }}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MobileTriage() {
  const item = window.DATA.triage[1]; // SP Group variance
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 100px" }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="icon-btn" style={{ marginLeft: -8 }}><window.I.ChevronLeft size={16}/></button>
          <span className="t-small" style={{ fontWeight: 500 }}>Triage · 2 of 5</span>
          <span className="spacer"></span>
          <window.I.Mail size={14} style={{ color: "var(--ink-3)" }}/>
        </div>

        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <span className="pill pill-accent">{item.category}</span>
          <span className="pill pill-warn"><window.I.Alert size={11}/>Variance</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1.3, marginBottom: 6 }}>
          {item.subject}
        </div>
        <div className="muted t-small" style={{ marginBottom: 18 }}>
          {item.sender}<span className="dot-sep"></span>{window.relativeTime(item.received)}
        </div>

        <div className="t-eyebrow" style={{ marginBottom: 10 }}>Agent extracted</div>
        <div className="kv-card" style={{ marginBottom: 22 }}>
          <div className="kv-row"><span>Payee</span><span className="kv-val">{item.extracted.payee}</span></div>
          <div className="kv-row"><span>Amount</span><span className="kv-val" style={{ color: "var(--warn)", fontWeight: 600 }}>{item.extracted.amount}</span></div>
          <div className="kv-row"><span>Due</span><span className="kv-val">{item.extracted.dueDate}</span></div>
          <div className="kv-row"><span>Previous</span><span className="kv-val">{item.extracted.previous}</span></div>
        </div>

        <div className="t-eyebrow" style={{ marginBottom: 10 }}>Proposed · 2 actions</div>
        <div className="col" style={{ gap: 8 }}>
          {item.proposedActions.map((a, i) => (
            <div key={i} className="row" style={{
              padding: "12px 14px",
              background: "var(--bg-elev)",
              borderRadius: "var(--r-md)",
              gap: 10,
              border: "1px solid var(--line)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "var(--bg-sunken)", display: "grid", placeItems: "center",
              }}>
                {a.type === "reconcile_bill" && <window.I.Finance size={14}/>}
                {a.type === "file_document" && <window.I.Drive size={14}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.title}</div>
                <div className="t-small" style={{ fontSize: 11 }}>{a.target}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "16px 16px 26px",
        background: "var(--bg-overlay)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--line)",
        display: "flex", gap: 8,
      }}>
        <button className="btn" style={{ flex: 1, height: 44, fontSize: 14 }}>
          <window.I.X size={14}/>Reject
        </button>
        <button className="btn btn-accent" style={{ flex: 2, height: 44, fontSize: 14 }}>
          <window.I.Check size={14}/>Confirm
        </button>
      </div>
    </>
  );
}

window.MobileView = MobileView;

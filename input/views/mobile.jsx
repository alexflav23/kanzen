// Mobile parity — all the features in iPhone-style screens
function MobileView() {
  return (
    <div className="mobile-stage hide-scroll">
      <div className="mobile-section-title">Overview</div>
      <div className="mobile-row">
        <Iphone label="Dashboard"><MobileDashboard /></Iphone>
        <Iphone label="Inbox · queue"><MobileInboxQueue /></Iphone>
        <Iphone label="Inbox · variance review"><MobileTriage /></Iphone>
        <Iphone label="Search"><MobileSearch /></Iphone>
      </div>

      <div className="mobile-section-title">Inventory</div>
      <div className="mobile-row">
        <Iphone label="Inventory grid"><MobileInventory /></Iphone>
        <Iphone label="Asset · timeline"><MobileAssetDetail /></Iphone>
        <Iphone label="Collections"><MobileCollections /></Iphone>
        <Iphone label="Insights"><MobileInsights /></Iphone>
      </div>

      <div className="mobile-section-title">Operations</div>
      <div className="mobile-row">
        <Iphone label="Property Bible"><MobileProperty /></Iphone>
        <Iphone label="Grocery list"><MobileList /></Iphone>
        <Iphone label="Calendar agenda"><MobileCalendar /></Iphone>
        <Iphone label="Capture receipt"><MobileCapture /></Iphone>
      </div>

      <div className="mobile-section-title">Finance & system</div>
      <div className="mobile-row">
        <Iphone label="Pay queue"><MobilePayQueue /></Iphone>
        <Iphone label="Approval"><MobileApproval /></Iphone>
        <Iphone label="Permissions"><MobilePermissions /></Iphone>
        <Iphone label="Backup"><MobileBackup /></Iphone>
      </div>
    </div>
  );
}

function Iphone({ children, label }) {
  return (
    <div>
      <div style={{
        textAlign: "center", marginBottom: 12,
        fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
        fontWeight: 600, color: "var(--ink-3)",
      }}>
        {label}
      </div>
      <div className="iphone">
        <div className="screen">
          <div className="notch"></div>
          <div style={{ paddingTop: 54, height: "100%", overflow: "auto", color: "var(--ink)" }} className="hide-scroll">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStatusBar({ tone }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      padding: "16px 30px 0",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 14, fontWeight: 600, color: tone === "light" ? "#fff" : "var(--ink)",
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

// Common card style
const mCard = {
  width: "100%",
  textAlign: "left",
  border: "1px solid var(--line)",
  background: "var(--bg-elev)",
  borderRadius: 14,
  padding: 16,
  color: "var(--ink)",
  cursor: "pointer",
};
const mEyebrow = {
  fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase",
  fontWeight: 600, color: "var(--ink-3)",
};
const mTitle = {
  fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em",
  color: "var(--ink)", lineHeight: 1.1,
};
const mSubcopy = { fontSize: 13, color: "var(--ink-2)" };

function MobileHeader({ back, title, count, action }) {
  return (
    <div className="row" style={{ marginBottom: 16, gap: 6 }}>
      {back && <button className="icon-btn" style={{ marginLeft: -8 }}><window.I.ChevronLeft size={16}/></button>}
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{title}</span>
      {count != null && <span className="pill" style={{ height: 18, padding: "0 6px", fontSize: 10.5 }}>{count}</span>}
      <span className="spacer"></span>
      {action}
    </div>
  );
}

function MobileTabBar({ active }) {
  const items = [
    { icon: "Dashboard", id: "home", label: "Home" },
    { icon: "Inbox", id: "inbox", label: "Inbox" },
    { icon: "Box", id: "inv", label: "Inventory" },
    { icon: "Finance", id: "money", label: "Money" },
    { icon: "Search", id: "search", label: "Search" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 12, left: 12, right: 12,
      background: "var(--bg-overlay)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid var(--line)",
      borderRadius: 22,
      padding: "10px 12px",
      display: "flex", justifyContent: "space-around",
    }}>
      {items.map(t => {
        const Ico = window.I[t.icon];
        const isActive = active === t.id;
        return (
          <div key={t.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: isActive ? "var(--accent)" : "var(--ink-2)",
          }}>
            <Ico size={18}/>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.01em" }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────── 1. Dashboard ───────────
function MobileDashboard() {
  const { triage, expenses, upcomingEvents } = window.DATA;
  const pending = expenses.filter(e => e.status === "Pending Approval");
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 100px" }}>
        <div style={mEyebrow}>Fri 22 May</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 4 }}>Good morning, Lorna</div>
        <div style={{ ...mSubcopy, marginBottom: 22 }}>
          {triage.length} in Inbox · {pending.length} to approve
        </div>

        <div className="col" style={{ gap: 10, marginBottom: 22 }}>
          <button style={mCard}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="agent-ribbon" style={{ color: "var(--ink-2)" }}><span className="agent-glyph"></span>Agent</span>
              <span className="spacer"></span>
              <window.I.ChevronRight size={14} style={{ color: "var(--ink-3)" }}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink)", marginBottom: 4 }}>5 items in Inbox</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>1 variance flag · 2 appointments · 1 delivery · 1 renewal</div>
          </button>
          <button style={mCard}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="pill pill-warn">2 awaiting approval</span>
              <span className="spacer"></span>
              <window.I.ChevronRight size={14} style={{ color: "var(--ink-3)" }}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink)", marginBottom: 4 }}>£1,840 · S$2,640</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>HVAC service · roof repair</div>
          </button>
        </div>

        <div style={{ ...mEyebrow, marginBottom: 12 }}>Upcoming</div>
        <div className="col" style={{ gap: 8 }}>
          {upcomingEvents.slice(0, 4).map(ev => {
            const d = new Date(ev.date);
            return (
              <div key={ev.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}>
                <div style={{ textAlign: "center", width: 38 }}>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: ".05em", fontWeight: 600 }}>{d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink)" }}>{d.getDate()}</div>
                </div>
                <div style={{ width: 3, height: 32, background: ev.color, borderRadius: 2 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{ev.time}{ev.property !== "—" && <><span style={{ margin: "0 5px", color: "var(--ink-4)" }}>·</span>{ev.property}</>}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MobileTabBar active="home"/>
    </>
  );
}

// ─────────── 2. Inbox queue list ───────────
function MobileInboxQueue() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 100px" }}>
        <div style={mEyebrow}>Review surface</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 16 }}>Inbox</div>

        {/* Stream tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflow: "auto" }} className="hide-scroll">
          {[
            { label: "Agent", count: 5, active: true },
            { label: "Reconciliation", count: 2 },
            { label: "Data quality", count: 14 },
            { label: "Reminders", count: 4 },
          ].map((t, i) => (
            <div key={i} style={{
              padding: "6px 12px", borderRadius: 999,
              background: t.active ? "var(--ink)" : "var(--bg-elev)",
              color: t.active ? "var(--bg)" : "var(--ink-2)",
              border: t.active ? 0 : "1px solid var(--line)",
              fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
            }}>
              {t.label} {t.count > 0 && <span style={{ opacity: 0.7 }}>· {t.count}</span>}
            </div>
          ))}
        </div>

        <div className="col" style={{ gap: 8 }}>
          {window.DATA.triage.map(item => (
            <button key={item.id} style={{ ...mCard, padding: 14 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="pill pill-outline" style={{ fontSize: 10.5, height: 18, padding: "0 7px" }}>{item.category}</span>
                {item.varianceFlag && <span className="pill pill-warn" style={{ fontSize: 10.5, height: 18, padding: "0 7px" }}><window.I.Alert size={10}/>Variance</span>}
                <span className="spacer"></span>
                <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{window.relativeTime(item.received)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.35, marginBottom: 4 }}>
                {item.subject.length > 64 ? item.subject.slice(0, 62) + "…" : item.subject}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.sender}</div>
            </button>
          ))}
        </div>
      </div>
      <MobileTabBar active="inbox"/>
    </>
  );
}

// ─────────── 3. Triage / variance review ───────────
function MobileTriage() {
  const item = window.DATA.triage[1];
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 110px" }}>
        <MobileHeader back title="Inbox · 2 of 5" action={<window.I.Mail size={14} style={{ color: "var(--ink-3)" }}/>}/>
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <span className="pill pill-accent">{item.category}</span>
          <span className="pill pill-warn"><window.I.Alert size={11}/>Variance</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1.3, color: "var(--ink)", marginBottom: 8 }}>{item.subject}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginBottom: 22 }}>{item.sender}<span style={{ margin: "0 6px", color: "var(--ink-4)" }}>·</span>{window.relativeTime(item.received)}</div>

        <div style={{ ...mEyebrow, marginBottom: 10 }}>Agent extracted</div>
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px", marginBottom: 22, color: "var(--ink)" }}>
          {[
            { k: "Payee", v: item.extracted.payee },
            { k: "Amount", v: item.extracted.amount, warn: true },
            { k: "Due", v: item.extracted.dueDate },
            { k: "Previous", v: item.extracted.previous },
          ].map((r, i) => (
            <div key={r.k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--line)" : 0 }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.k}</span>
              <span style={{ fontSize: 13.5, fontWeight: r.warn ? 600 : 500, color: r.warn ? "var(--warn)" : "var(--ink)", textAlign: "right" }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ ...mEyebrow, marginBottom: 10 }}>Proposed · 2 actions</div>
        <div className="col" style={{ gap: 8 }}>
          {item.proposedActions.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-sunken)", display: "grid", placeItems: "center" }}>
                {a.type === "reconcile_bill" && <window.I.Finance size={14}/>}
                {a.type === "file_document" && <window.I.Drive size={14}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{a.target}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 16px 30px", background: "var(--bg-overlay)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
        <button className="btn" style={{ flex: 1, height: 46, fontSize: 14 }}><window.I.X size={14}/>Reject</button>
        <button className="btn btn-accent" style={{ flex: 2, height: 46, fontSize: 14 }}><window.I.Check size={14}/>Confirm</button>
      </div>
    </>
  );
}

// ─────────── 4. Search ───────────
function MobileSearch() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 30px" }}>
        <div style={mEyebrow}>Search Kanzen</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 16 }}>Find anything</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--accent)", borderRadius: 12, marginBottom: 20 }}>
          <window.I.Search size={15} style={{ color: "var(--ink-3)" }}/>
          <span style={{ fontSize: 14, color: "var(--ink)" }}>rolex</span>
          <span className="spacer"></span>
          <span style={{ width: 1, height: 16, background: "var(--accent)" }}/>
        </div>

        <div style={{ ...mEyebrow, marginBottom: 8 }}>Asset</div>
        <div className="col" style={{ gap: 8, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(140deg,#1A2436,#4B6483)", display: "grid", placeItems: "center" }}>
              <window.I.Watch size={16} style={{ color: "rgba(255,255,255,.7)" }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Rolex Submariner Date</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>£11,200 · Wardian safe</div>
            </div>
            <window.I.ChevronRight size={14} style={{ color: "var(--ink-3)" }}/>
          </div>
        </div>

        <div style={{ ...mEyebrow, marginBottom: 8 }}>Document</div>
        <div className="col" style={{ gap: 8, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <window.I.Documents size={16} style={{ color: "var(--ink-3)" }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Rolex Submariner — purchase invoice.pdf</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Receipt · 12 Jun 2019</div>
            </div>
          </div>
        </div>

        <div style={{ ...mEyebrow, marginBottom: 8 }}>Suggested action</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--accent-soft)", borderRadius: 12 }}>
          <window.I.Plus size={15} style={{ color: "var(--accent)" }}/>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>Log a service event for Rolex</span>
        </div>
      </div>
    </>
  );
}

// ─────────── 5. Inventory grid ───────────
function MobileInventory() {
  const assets = window.INVENTORY.assets.slice(0, 6);
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 16px 100px" }}>
        <div style={{ padding: "0 4px" }}>
          <div style={mEyebrow}>165 assets · £274k</div>
          <div style={{ ...mTitle, marginTop: 6, marginBottom: 14 }}>Inventory</div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflow: "auto", padding: "0 4px" }} className="hide-scroll">
          {["All", "Watches", "Guitars", "Art", "Furniture", "Clothing"].map((c, i) => (
            <span key={c} style={{
              padding: "5px 12px", borderRadius: 999,
              background: i === 0 ? "var(--ink)" : "var(--bg-elev)",
              color: i === 0 ? "var(--bg)" : "var(--ink-2)",
              border: i === 0 ? 0 : "1px solid var(--line)",
              fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
            }}>{c}</span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {assets.map(a => {
            const Ico = window.I[a.photo?.icon] || window.I.Box;
            return (
              <div key={a.id} style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ height: 100, background: a.photo?.fill, display: "grid", placeItems: "center", position: "relative" }}>
                  <Ico size={28} style={{ color: "rgba(255,255,255,.5)" }}/>
                  {a.mode === "grouped-quantity" && (
                    <span style={{ position: "absolute", top: 6, right: 6, fontSize: 10, fontWeight: 600, padding: "2px 7px", background: "rgba(255,255,255,.2)", color: "#fff", borderRadius: 999 }}>×{a.tracking.quantity}</span>
                  )}
                </div>
                <div style={{ padding: "10px 12px 12px" }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 2 }}>{a.maker}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.25, marginBottom: 4, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 30 }}>{a.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }} className="num">{window.fmtMoneyShort(a.value?.current, a.currency)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MobileTabBar active="inv"/>
    </>
  );
}

// ─────────── 6. Asset detail · timeline ───────────
function MobileAssetDetail() {
  const a = window.INVENTORY.assetById.ast_rolex;
  const timeline = (window.INVENTORY.timelines[a.id] || []).slice(0, 5);
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, background: a.photo.fill, display: "grid", placeItems: "center" }}>
        <window.I.Watch size={64} style={{ color: "rgba(255,255,255,.45)", marginTop: 30 }}/>
      </div>
      <MobileStatusBar tone="light"/>
      {/* Back chevron */}
      <button className="icon-btn" style={{ position: "absolute", top: 56, left: 12, zIndex: 5, background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", color: "#fff" }}>
        <window.I.ChevronLeft size={16}/>
      </button>

      <div style={{ marginTop: 200, padding: "0 18px 30px", position: "relative" }}>
        <div style={{ background: "var(--bg)", borderRadius: "16px 16px 0 0", marginLeft: -18, marginRight: -18, padding: "18px 20px 24px" }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600 }}>Watches</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>Rolex</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--ink)", lineHeight: 1.15, marginTop: 2 }}>{a.title}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Current value</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink)" }} className="num">{window.fmtMoneyShort(a.value.current, a.currency)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Insured</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--ink)" }} className="num">{window.fmtMoneyShort(a.value.insured, a.currency)}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 10px", background: "var(--positive-soft)", color: "var(--positive)", borderRadius: 8 }}>
            <window.I.Shield size={13}/>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(a.completeness * 100)}% complete</span>
            <span className="spacer"></span>
          </div>

          <div style={{ ...mEyebrow, marginTop: 22, marginBottom: 10 }}>Timeline</div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 1, background: "var(--line)" }}/>
            <div className="col" style={{ gap: 14 }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, position: "relative" }}>
                  <div style={{ paddingTop: 2 }}><window.EventDot type={e.type}/></div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>
                      {window.fmtDate(e.at)}{e.party && <> · {e.party}</>}
                    </div>
                    {e.cost && <div style={{ marginTop: 4 }}><span className="pill pill-outline" style={{ fontSize: 10 }}>£{e.cost}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────── 7. Collections ───────────
function MobileCollections() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 30px" }}>
        <div style={mEyebrow}>Inventory · groupings</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 18 }}>Collections</div>

        <div className="col" style={{ gap: 12 }}>
          {window.INVENTORY.collections.map(c => {
            const previews = c.members.slice(0, 4).map(id => window.INVENTORY.assetById[id]).filter(Boolean);
            return (
              <div key={c.id} style={{ ...mCard, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, height: 70, background: "var(--bg-sunken)" }}>
                  {previews.concat(Array.from({ length: 4 - previews.length })).slice(0, 4).map((a, i) => {
                    if (!a) return <div key={"e" + i} style={{ background: "var(--bg-sunken)" }}/>;
                    const Ico = window.I[a.photo?.icon] || window.I.Box;
                    return (
                      <div key={a.id} style={{ background: a.photo?.fill, display: "grid", placeItems: "center" }}>
                        <Ico size={16} style={{ color: "rgba(255,255,255,.55)" }}/>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                    <span className="spacer"></span>
                    {c.visibility === "Principal" && <window.I.Lock size={11} style={{ color: "var(--ink-3)" }}/>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                    {c.members.length} assets
                    {c.totalValue && <> · {window.fmtMoneyShort(c.totalValue, c.currency)}</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────── 8. Insights ───────────
function MobileInsights() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 30px" }}>
        <div style={mEyebrow}>Aggregate · Principal</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 18 }}>Insights</div>

        <div className="col" style={{ gap: 10, marginBottom: 18 }}>
          <div style={{ ...mCard, padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Inventory value</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--ink)", marginTop: 2 }} className="num">£274,800</div>
            <div style={{ fontSize: 11, color: "var(--positive)", marginTop: 4 }}>+12% YoY</div>
          </div>
          <div style={{ ...mCard, padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Completeness</div>
            <div className="row" style={{ marginTop: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)" }} className="num">84%</div>
            </div>
            <div className="bar" style={{ marginTop: 8 }}><i style={{ width: "84%", background: "var(--positive)" }}/></div>
          </div>
        </div>

        <div style={{ ...mEyebrow, marginBottom: 10 }}>Lifetime spend · by category</div>
        <div style={{ ...mCard, padding: 14 }}>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 14, background: "var(--bg-sunken)" }}>
            {[
              { c: "#A855F7", w: 46 },
              { c: "#4F46E5", w: 26 },
              { c: "#B45309", w: 11 },
              { c: "#15803D", w: 6 },
              { c: "#F97316", w: 7 },
              { c: "#0EA5E9", w: 4 },
            ].map((s, i) => (
              <div key={i} style={{ width: s.w + "%", background: s.c }}/>
            ))}
          </div>
          <div className="col" style={{ gap: 8 }}>
            {[
              { c: "#A855F7", label: "Art", v: "£92,000", pct: "46%" },
              { c: "#4F46E5", label: "Watches", v: "£51,650", pct: "26%" },
              { c: "#B45309", label: "Porcelain", v: "£22,000", pct: "11%" },
              { c: "#15803D", label: "Clothing", v: "£11,720", pct: "6%" },
            ].map(r => (
              <div key={r.label} className="row">
                <span style={{ width: 8, height: 8, background: r.c, borderRadius: 2 }}/>
                <span style={{ fontSize: 12, color: "var(--ink)" }}>{r.label}</span>
                <span className="spacer"></span>
                <span style={{ fontSize: 11, color: "var(--ink-3)", width: 40 }}>{r.pct}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }} className="num">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────── 9. Property Bible ───────────
function MobileProperty() {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "linear-gradient(160deg, #1B1F2E 0%, #2A2E40 60%, #3B3F55 100%)" }}/>
      <MobileStatusBar tone="light"/>
      <button className="icon-btn" style={{ position: "absolute", top: 56, left: 12, zIndex: 5, background: "rgba(255,255,255,.18)", color: "#fff" }}>
        <window.I.ChevronLeft size={16}/>
      </button>
      <div style={{ position: "absolute", top: 130, left: 20, right: 20, color: "#fff", zIndex: 4 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".06em", fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>WARDIAN · LONDON</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em" }}>Apt 5206</div>
      </div>
      <div style={{ marginTop: 196, padding: "0 18px 30px", position: "relative" }}>
        <div style={{ background: "var(--bg)", borderRadius: "16px 16px 0 0", marginLeft: -18, marginRight: -18, padding: "18px 20px 24px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
            {["Overview", "Rooms", "Assets", "Bills"].map((t, i) => (
              <div key={t} style={{
                padding: "8px 10px", fontSize: 12.5, fontWeight: 500,
                color: i === 0 ? "var(--ink)" : "var(--ink-3)",
                borderBottom: "1.5px solid " + (i === 0 ? "var(--ink)" : "transparent"),
              }}>{t}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Rooms", v: 5 },
              { label: "Assets", v: 38 },
              { label: "Bills", v: 9 },
              { label: "Vendors", v: 14 },
            ].map(s => (
              <div key={s.label} style={{ padding: "12px 14px", background: "var(--bg-sunken)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.014em", marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ ...mEyebrow, marginBottom: 10 }}>Linked systems</div>
          <div className="col" style={{ gap: 8 }}>
            {[
              { label: "Todoist project", icon: "Todoist", val: "Wardian" },
              { label: "Google Calendar", icon: "Calendar", val: "household" },
              { label: "Drive folder", icon: "Drive", val: "Wardian 5206" },
              { label: "1Password vault", icon: "Lock", val: "1P · Wardian" },
            ].map(l => {
              const Ico = window.I[l.icon];
              return (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
                  <Ico size={15} style={{ color: "var(--ink-3)" }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{l.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink)" }}>{l.val}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────── 10. Lists / Grocery ───────────
function MobileList() {
  const list = window.DATA.lists[0];
  const [items, setItems] = React.useState(list.items.slice(0, 7));
  function toggle(id) {
    setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 90px" }}>
        <MobileHeader back title="Lists"/>
        <div style={mEyebrow}>Wardian · Weekly</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 4 }}>Grocery</div>
        <div style={mSubcopy}>Tue 26 May · Waitrose</div>

        <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 16 }}>
          <span className="pill pill-positive" style={{ fontSize: 10.5 }}><window.I.Check size={10}/>5 confirmed</span>
          <span className="pill pill-warn" style={{ fontSize: 10.5 }}><window.I.Alert size={10}/>2 need approval</span>
        </div>

        <div className="col" style={{ gap: 6 }}>
          {items.map(i => (
            <div key={i.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px",
              background: "var(--bg-elev)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              opacity: i.status === "needs_approval" ? 0.55 : 1,
            }}>
              <button onClick={() => toggle(i.id)} style={{
                width: 22, height: 22, padding: 0,
                border: "1.5px solid " + (i.checked ? "var(--accent)" : "var(--line-strong)"),
                background: i.checked ? "var(--accent)" : "transparent",
                borderRadius: 6, display: "grid", placeItems: "center",
              }}>
                {i.checked && <window.I.Check size={11} stroke="var(--accent-ink)"/>}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", textDecoration: i.checked ? "line-through" : "none" }}>{i.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{i.category}{i.qty > 1 && <> · ×{i.qty}</>}</div>
              </div>
              {i.status === "needs_approval" && <span className="pill pill-warn" style={{ fontSize: 10 }}>Approve</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px 26px", background: "var(--bg-overlay)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--line)" }}>
        <button className="btn btn-accent" style={{ width: "100%", height: 44, fontSize: 14 }}>Place order with Waitrose</button>
      </div>
    </>
  );
}

// ─────────── 11. Calendar agenda ───────────
function MobileCalendar() {
  const days = [
    { date: "Mon 25 May", events: [] },
    { date: "Tue 26 May", events: [{ title: "Waitrose delivery", time: "11:00", color: "#4F46E5" }] },
    { date: "Wed 27 May", events: [] },
    { date: "Thu 28 May", events: [
      { title: "HVAC service · Hudson Sandler", time: "09:00", color: "#0EA5E9" },
      { title: "Dinner · The Dorchester", time: "19:30", color: "#A855F7" },
    ] },
    { date: "Fri 29 May", events: [] },
  ];
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 30px" }}>
        <div style={mEyebrow}>This week</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 18 }}>Calendar</div>

        <div className="col" style={{ gap: 18 }}>
          {days.map(d => {
            const isHighlight = d.events.length > 0;
            return (
              <div key={d.date}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: isHighlight ? "var(--ink)" : "var(--ink-3)",
                  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8,
                }}>{d.date}</div>
                {d.events.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink-4)", padding: "4px 0" }}>—</div>
                ) : (
                  <div className="col" style={{ gap: 6 }}>
                    {d.events.map((e, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px",
                        background: "var(--bg-elev)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                      }}>
                        <div style={{ width: 3, height: 28, background: e.color, borderRadius: 2 }}/>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{e.title}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{e.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────── 12. Capture receipt ───────────
function MobileCapture() {
  return (
    <>
      <MobileStatusBar tone="light"/>
      <div style={{ position: "absolute", inset: 0, background: "#000" }}/>
      <button className="icon-btn" style={{ position: "absolute", top: 56, left: 12, zIndex: 5, background: "rgba(255,255,255,.15)", color: "#fff" }}>
        <window.I.X size={16}/>
      </button>
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.85)", zIndex: 4, fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>
        Receipt capture
      </div>
      {/* Viewfinder */}
      <div style={{
        position: "absolute", top: 150, left: 30, right: 30, bottom: 230,
        border: "2px solid rgba(255,255,255,.4)",
        borderRadius: 12,
        zIndex: 3,
      }}>
        {/* Corner markers */}
        {[["t", "l"], ["t", "r"], ["b", "l"], ["b", "r"]].map(([v, h]) => (
          <div key={v+h} style={{
            position: "absolute",
            [v === "t" ? "top" : "bottom"]: -2,
            [h === "l" ? "left" : "right"]: -2,
            width: 26, height: 26,
            borderTop: v === "t" ? "3px solid var(--accent)" : "none",
            borderBottom: v === "b" ? "3px solid var(--accent)" : "none",
            borderLeft: h === "l" ? "3px solid var(--accent)" : "none",
            borderRight: h === "r" ? "3px solid var(--accent)" : "none",
            borderRadius: 4,
          }}/>
        ))}
        {/* Faux receipt preview */}
        <div style={{
          position: "absolute", inset: 18,
          background: "#FFFEF8",
          borderRadius: 6,
          padding: "20px 18px",
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          color: "#111",
          lineHeight: 1.6,
          opacity: 0.92,
        }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>JOHN LEWIS</div>
          <div style={{ borderTop: "1px dashed #888", paddingTop: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Dyson V15 Detect</span><span>699.99</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Extended care 3yr</span><span>50.00</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Bag for life</span><span>0.10</span></div>
          </div>
          <div style={{ borderTop: "1px dashed #888", paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>TOTAL</span><span>£750.09</span>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 8 }}>19 May 2026 14:32</div>
        </div>
      </div>

      {/* Bottom shutter */}
      <div style={{
        position: "absolute", bottom: 30, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 60,
        zIndex: 5,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,.1)", display: "grid", placeItems: "center" }}>
          <window.I.Photo size={16} style={{ color: "#fff" }}/>
        </div>
        <div style={{ width: 72, height: 72, borderRadius: 999, border: "4px solid #fff", padding: 4 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 999, background: "#fff" }}/>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,.1)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18 }}>
          ⚡
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.8)", fontSize: 11.5, zIndex: 5 }}>
        Auto-detect · agent will extract line items
      </div>
    </>
  );
}

// ─────────── 13. Pay queue ───────────
function MobilePayQueue() {
  const q = window.DATA.payQueue.slice(0, 5);
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "8px 20px 100px" }}>
        <div style={mEyebrow}>Finance</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 4 }}>Pay queue</div>
        <div style={mSubcopy}>Due next 30 days</div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, padding: "10px 12px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)" }}>GBP</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 2 }} className="num">£5,019</div>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)" }}>SGD</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 2 }} className="num">S$1,180</div>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", background: "var(--warn-soft)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: "var(--warn)" }}>Review</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--warn)", marginTop: 2 }}>2</div>
          </div>
        </div>

        <div className="col" style={{ gap: 8 }}>
          {q.map(p => {
            const m = window.DATA.paymentMethods.find(pm => pm.id === p.method);
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}>
                <div style={{ textAlign: "center", width: 36 }}>
                  <div style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: ".05em", fontWeight: 600 }}>{new Date(p.due).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1 }}>{new Date(p.due).getDate()}</div>
                </div>
                <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{p.payee}</span>
                    {p.varianceFlag && <span className="pill pill-warn" style={{ fontSize: 10, height: 16, padding: "0 5px" }}>!</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m?.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }} className="num">{window.fmtMoneyShort(p.amount, p.currency)}</div>
                  {p.auto && <div style={{ fontSize: 10, color: "var(--positive)", fontWeight: 600 }}>auto</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MobileTabBar active="money"/>
    </>
  );
}

// ─────────── 14. Approval card ───────────
function MobileApproval() {
  const e = window.DATA.expenses.find(x => x.status === "Pending Approval");
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 100px" }}>
        <MobileHeader back title="Approval · 1 of 2"/>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6, marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--bg-sunken)",
            display: "grid", placeItems: "center",
          }}>
            <window.I.Receipt size={26} style={{ color: "var(--ink-2)" }}/>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Pending approval</div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.025em" }} className="num">£1,840.00</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>Above £1,500 threshold</div>
        </div>

        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
          {[
            { k: "Description", v: e.desc },
            { k: "Payee", v: e.payee },
            { k: "Property", v: "Wardian" },
            { k: "Category", v: e.category },
            { k: "Requested by", v: e.requested },
            { k: "Date", v: window.fmtDate(e.date) },
          ].map((r, i) => (
            <div key={r.k} style={{
              display: "grid", gridTemplateColumns: "100px 1fr",
              padding: "8px 0",
              borderBottom: i < 5 ? "1px solid var(--line)" : 0,
            }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.k}</span>
              <span style={{ fontSize: 12.5, color: "var(--ink)", textAlign: "right" }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--accent-soft)", borderRadius: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <window.I.Sparkle size={13} style={{ color: "var(--accent)" }}/>
          <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Maintenance plan · Daikin VRV-IV · expected £1,840</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px 26px", background: "var(--bg-overlay)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
        <button className="btn" style={{ flex: 1, height: 46, fontSize: 14 }}><window.I.X size={14}/>Reject</button>
        <button className="btn btn-accent" style={{ flex: 2, height: 46, fontSize: 14 }}><window.I.Check size={14}/>Approve</button>
      </div>
    </>
  );
}

// ─────────── 15. Permissions ───────────
function MobilePermissions() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 30px" }}>
        <MobileHeader back title="Settings"/>
        <div style={mEyebrow}>Security</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 4 }}>Permissions</div>
        <div style={mSubcopy}>Role + scope · enforced server-side</div>

        <div style={{ ...mEyebrow, marginTop: 20, marginBottom: 10 }}>Marcia Almeida Pereira Coomber</div>
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <div className="row" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: "#34C759" }}>MA</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Staff</div>
              <div style={{ fontSize: 11, color: "var(--accent)" }}>Wardian only</div>
            </div>
          </div>
          {[
            { label: "Tasks", level: "Write" },
            { label: "Lists", level: "Write" },
            { label: "Expenses", level: "Write" },
            { label: "Inventory", level: "—" },
            { label: "Finance · Bills", level: "—" },
            { label: "Audit log", level: "—" },
          ].map((r, i) => (
            <div key={r.label} style={{
              display: "flex", alignItems: "center",
              padding: "11px 14px",
              borderBottom: i < 5 ? "1px solid var(--line)" : 0,
            }}>
              <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1 }}>{r.label}</span>
              <span style={{
                fontSize: 11.5, fontWeight: 600,
                padding: "3px 10px",
                background: r.level === "Write" ? "var(--accent-soft)" : "var(--bg-sunken)",
                color: r.level === "Write" ? "var(--accent)" : "var(--ink-4)",
                borderRadius: 6,
              }}>{r.level}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────── 16. Backup ───────────
function MobileBackup() {
  return (
    <>
      <MobileStatusBar/>
      <div style={{ padding: "6px 20px 30px" }}>
        <MobileHeader back title="Settings"/>
        <div style={mEyebrow}>Catastrophic-loss recovery</div>
        <div style={{ ...mTitle, marginTop: 6, marginBottom: 18 }}>Backup</div>

        <div style={{ ...mCard, marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <window.I.Shield size={15} style={{ color: "var(--positive)" }}/>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Last export · success</span>
            <span className="spacer"></span>
          </div>
          {[
            { k: "Created", v: "22 May 2026 · 03:00" },
            { k: "Size", v: "1,843 MB" },
            { k: "Encryption", v: "age · enabled" },
            { k: "Next", v: "Daily · 03:00" },
          ].map((r, i) => (
            <div key={r.k} style={{
              display: "grid", gridTemplateColumns: "100px 1fr",
              padding: "8px 0",
              borderBottom: i < 3 ? "1px solid var(--line)" : 0,
            }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.k}</span>
              <span style={{ fontSize: 12.5, color: "var(--ink)", textAlign: "right" }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ ...mEyebrow, marginBottom: 10 }}>Annual snapshots</div>
        <div className="col" style={{ gap: 8, marginBottom: 16 }}>
          {[{ year: 2025, size: "1,620 MB" }, { year: 2024, size: "1,410 MB" }].map(s => (
            <div key={s.year} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.012em", width: 44 }}>{s.year}</div>
              <div style={{ flex: 1, fontSize: 11.5, color: "var(--ink-2)" }}>{s.size} · verified</div>
              <span className="pill" style={{ fontSize: 10 }}><window.I.Lock size={10}/>immutable</span>
            </div>
          ))}
        </div>

        <button className="btn btn-accent" style={{ width: "100%", height: 44, fontSize: 13.5 }}>
          <window.I.Download size={14}/>Run full export now
        </button>
      </div>
    </>
  );
}

window.MobileView = MobileView;

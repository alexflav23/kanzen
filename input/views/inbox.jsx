// Unified Inbox — agent proposals, reconciliation, data quality, reminders
function InboxView() {
  const [stream, setStream] = React.useState("agent");
  const counts = {
    agent: window.DATA.triage.length,
    reconciliation: window.INVENTORY.reconciliation.filter(r => r.state === "unmatched" || r.state === "suggested").length,
    quality: window.INVENTORY.dataQuality.expensiveMissingProof + window.INVENTORY.dataQuality.suspectedDuplicates + window.INVENTORY.dataQuality.missingProof,
    reminders: 4,
  };

  return (
    <div className="page fade-in" style={{ padding: "28px 32px 60px", maxWidth: 1400 }}>
      <header style={{ marginBottom: 22 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Review surface</div>
        <div className="t-title">Inbox</div>
        <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
          Everything that needs a human eye — proposals from the agent, reconciliation gaps, data-quality nudges, and reminders coming due.
        </div>
      </header>

      <div className="tabs">
        {[
          { id: "agent", label: "Agent proposals", count: counts.agent, icon: "Sparkle" },
          { id: "reconciliation", label: "Reconciliation", count: counts.reconciliation, icon: "Refresh" },
          { id: "quality", label: "Data quality", count: counts.quality, icon: "Shield" },
          { id: "reminders", label: "Reminders", count: counts.reminders, icon: "Bell" },
        ].map(t => {
          const Ico = window.I[t.icon];
          return (
            <button key={t.id} className={stream === t.id ? "active" : ""} onClick={() => setStream(t.id)}>
              <span className="row" style={{ gap: 6 }}>
                <Ico size={13}/>
                {t.label}
                {t.count > 0 && <span className="pill" style={{ height: 18, padding: "0 6px", fontSize: 10.5, marginLeft: 2 }}>{t.count}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {stream === "agent" && <window.Triage/>}
      {stream === "reconciliation" && <ReconciliationStream/>}
      {stream === "quality" && <DataQualityStream/>}
      {stream === "reminders" && <RemindersStream/>}
    </div>
  );
}

function ReconciliationStream() {
  const recs = window.INVENTORY.reconciliation;
  const needs = recs.filter(r => r.state === "unmatched" || r.state === "suggested");
  const done = recs.filter(r => r.state === "matched" || r.state === "split" || r.state === "ignored");
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Needs attention · {needs.length}</span>
          <span className="t-small">Bank transactions not yet matched to a receipt</span>
        </div>
        {needs.map(r => (
          <div className="card-row" key={r.id}>
            <div style={{ width: 56, textAlign: "center" }}>
              <div className="t-small" style={{ fontSize: 10 }}>{new Date(r.date).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1 }}>{new Date(r.date).getDate()}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{r.merchant}</span>
                {r.state === "suggested" && (
                  <span className="pill pill-accent"><window.I.Sparkle size={10}/>Suggested · {Math.round(r.confidence * 100)}%</span>
                )}
                {r.state === "unmatched" && (
                  <span className="pill pill-warn">Unmatched</span>
                )}
              </div>
              <div className="muted t-small">{r.account}{r.note && <><span className="dot-sep"></span>{r.note}</>}</div>
            </div>
            <div className="num" style={{ fontWeight: 500 }}>{window.fmtMoneyShort(r.amount, r.currency)}</div>
            {r.state === "suggested" ? (
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm"><window.I.Edit size={12}/>Review</button>
                <button className="btn btn-accent btn-sm"><window.I.Check size={12}/>Confirm match</button>
              </div>
            ) : (
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm">Mark ignored</button>
                <button className="btn btn-accent btn-sm">Link receipt</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Resolved · last 30 days</span>
        </div>
        {done.slice(0, 5).map(r => (
          <div className="card-row" key={r.id}>
            <window.I.Check size={14} style={{ color: "var(--positive)" }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5 }}>{r.merchant}<span className="muted">  ·  {r.account}</span></div>
              <div className="muted t-small">
                {window.fmtDate(r.date)}<span className="dot-sep"></span>
                {r.state === "matched" && "Matched · receipt linked"}
                {r.state === "split" && r.note}
                {r.state === "ignored" && r.note}
              </div>
            </div>
            <div className="num t-small">{window.fmtMoneyShort(r.amount, r.currency)}</div>
            <span className="pill">{r.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataQualityStream() {
  const issues = [
    { kind: "Expensive · no proof", count: 2, assets: ["Audemars Piguet Royal Oak", "Picasso 'La Colombe'"], severity: "high", action: "Add proof of purchase / appraisal" },
    { kind: "Missing photos", count: 9, assets: ["Drake's silk ties", "Smythson notebook", "+7 more"], severity: "medium", action: "Upload photos from Mobile" },
    { kind: "Missing location", count: 3, assets: ["Pickup truck cover", "Storage box 3", "Camping kit"], severity: "low", action: "Assign property + sub-location" },
    { kind: "Suspected duplicate", count: 1, assets: ["Two 'Dyson V15' assets created within 24h"], severity: "medium", action: "Review and merge" },
    { kind: "No category", count: 0, assets: [], severity: "low" },
    { kind: "Suspected anomaly", count: 1, assets: ["Henry Poole · £4,200 invoice · 80% above prior"], severity: "high", action: "Confirm or flag merchant" },
  ];
  const colorOf = (s) => s === "high" ? "var(--danger)" : s === "medium" ? "var(--warn)" : "var(--ink-3)";
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card card-pad-lg">
        <div className="row" style={{ marginBottom: 16 }}>
          <window.I.Shield size={18} style={{ color: "var(--positive)" }}/>
          <span className="t-h2">Registry completeness</span>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.025em" }} className="num">
            {Math.round(window.INVENTORY.totalCompleteness * 100)}%
          </div>
          <span className="muted" style={{ marginLeft: 14 }}>of {window.INVENTORY.assetTotal} assets fully detailed</span>
        </div>
        <div className="bar"><i style={{ width: (window.INVENTORY.totalCompleteness * 100) + "%", background: "var(--positive)" }}/></div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Issues</span>
        </div>
        {issues.filter(i => i.count > 0).map((i, ix) => (
          <div className="card-row" key={ix}>
            <div style={{ width: 4, alignSelf: "stretch", background: colorOf(i.severity), borderRadius: 2, marginRight: 4 }}/>
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{i.kind}</span>
                <span className="pill" style={{ background: colorOf(i.severity) + "1F", color: colorOf(i.severity), border: 0 }}>{i.count} asset{i.count === 1 ? "" : "s"}</span>
              </div>
              <div className="muted t-small">{i.assets.join(" · ")}</div>
              {i.action && <div className="t-small" style={{ marginTop: 4, color: "var(--ink-2)" }}>→ {i.action}</div>}
            </div>
            <button className="btn btn-sm">Resolve</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RemindersStream() {
  const reminders = [
    { id: "rm1", kind: "Maintenance", title: "Daikin VRV-IV quarterly service", due: "2026-05-28", days: 6, asset: "Wardian HVAC" },
    { id: "rm2", kind: "Warranty", title: "Sonos Architectural · warranty lapsed", due: "2025-09-04", days: -260, severity: "warn", asset: "Wardian living room AV" },
    { id: "rm3", kind: "Appraisal", title: "Picasso lithograph · refresh appraisal", due: "2026-09-12", days: 113, asset: "Picasso 'La Colombe'" },
    { id: "rm4", kind: "Backup", title: "Annual immutable snapshot due", due: "2027-01-01", days: 224, suggestion: true },
  ];
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Upcoming · {reminders.length}</span></div>
      {reminders.map(r => (
        <div className="card-row" key={r.id}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: r.severity === "warn" ? "var(--danger-soft)" : "var(--bg-sunken)",
            color: r.severity === "warn" ? "var(--danger)" : "var(--ink)",
            display: "grid", placeItems: "center",
          }}>
            <window.I.Bell size={15}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
            <div className="muted t-small">
              {r.kind}<span className="dot-sep"></span>
              {r.asset && <>{r.asset}<span className="dot-sep"></span></>}
              {r.days < 0 ? <span style={{ color: "var(--danger)" }}>lapsed {Math.abs(r.days)} days ago</span> : `in ${r.days} days`}
            </div>
          </div>
          <button className="btn btn-sm">Snooze</button>
          <button className="btn btn-accent btn-sm">Act</button>
        </div>
      ))}
    </div>
  );
}

window.InboxView = InboxView;

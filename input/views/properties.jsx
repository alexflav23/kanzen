// Properties list + Property Bible drilldown
function Properties({ onOpen }) {
  return (
    <div className="page fade-in">
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>The Bibles</div>
          <div className="t-title">Properties</div>
          <div className="muted t-body" style={{ marginTop: 6 }}>One record per property. The full picture: rooms, assets, systems, documents.</div>
        </div>
        <button className="btn"><window.I.Plus size={14}/> Add property</button>
      </header>

      <div className="grid-2" style={{ gap: 24 }}>
        {window.DATA.properties.map(p => (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="card"
            style={{
              padding: 0,
              border: "1px solid var(--line)",
              background: "var(--bg-elev)",
              cursor: "pointer",
              textAlign: "left",
              overflow: "hidden",
              transition: "transform .2s var(--ease-out), box-shadow .2s var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "var(--shadow-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "var(--shadow-1)";
            }}
          >
            <div className={"prop-cover " + p.cover} style={{ borderRadius: 0, height: 180 }}>
              <div style={{ position: "absolute", top: 16, left: 18, right: 18, display: "flex", justifyContent: "space-between" }}>
                <span className="pill pill-outline" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
                  {p.jurisdiction}
                </span>
                <span className="pill pill-outline" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
                  {p.ownership}
                </span>
              </div>
              <div style={{ position: "absolute", bottom: 18, left: 20, right: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.018em" }}>{p.name}</div>
                <div style={{ fontSize: 13, opacity: 0.78, marginTop: 2 }}>{p.address}</div>
              </div>
            </div>
            <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                { label: "Rooms", v: p.rooms },
                { label: "Assets", v: p.assets },
                { label: "Bills", v: p.bills },
                { label: "Vendors", v: p.vendors },
              ].map(s => (
                <div key={s.label}>
                  <div className="t-small" style={{ fontSize: 11, color: "var(--ink-4)" }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.014em", marginTop: 2 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PropertyBible({ propId, onBack, onAddMaintenance }) {
  const p = window.DATA.properties.find(x => x.id === propId);
  const [tab, setTab] = React.useState("overview");
  const [openRoom, setOpenRoom] = React.useState(null);
  if (!p) return null;
  const rooms = window.DATA.rooms[p.id] || [];
  const assets = window.DATA.assets[p.id] || [];
  const bills = window.DATA.bills.filter(b => b.property === p.id);
  const plans = window.DATA.maintenancePlans.filter(m => m.property === p.id);

  return (
    <div className="page fade-in" style={{ paddingTop: 28 }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 14 }}>
        <window.I.ChevronLeft size={14}/> All properties
      </button>

      {/* Cover */}
      <div className={"prop-cover " + p.cover} style={{ height: 220, marginBottom: 28 }}>
        <div style={{ position: "absolute", top: 22, left: 24, right: 24, display: "flex", justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill pill-outline" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>
              {p.jurisdiction}
            </span>
            <span className="pill pill-outline" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>
              {p.ownership}
            </span>
            <span className="pill pill-outline" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>
              {p.type}
            </span>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 26, left: 28, right: 28 }}>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em" }}>{p.name}</div>
          <div style={{ fontSize: 14, opacity: 0.82, marginTop: 4 }}>{p.address}</div>
        </div>
      </div>

      <div className="tabs">
        {["overview", "rooms", "assets", "utilities", "maintenance", "defects", "documents"].map(t => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
          <section className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>Particulars</div>
            <dl className="meta-grid">
              <dt>Type</dt><dd>{p.type}</dd>
              <dt>Ownership</dt><dd>{p.ownership}</dd>
              <dt>Jurisdiction</dt><dd>{p.jurisdiction}</dd>
              <dt>Building mgmt</dt><dd>{p.buildingMgmt}</dd>
              <dt>Address</dt><dd>{p.address}</dd>
            </dl>
          </section>
          <section className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>Linked systems</div>
            <div className="col" style={{ gap: 10 }}>
              {[
                { icon: "Todoist", label: "Todoist project", v: p.todoistProjectId, ext: true },
                { icon: "Calendar", label: "Google Calendar", v: p.calendarId, ext: true },
                { icon: "Drive", label: "Drive folder", v: p.driveFolderId, ext: true },
                { icon: "Lock", label: "1Password vault", v: p.vault, ext: false },
              ].map(l => {
                const Ico = window.I[l.icon];
                return (
                  <div key={l.label} className="row" style={{
                    padding: "12px 14px",
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--r-md)",
                  }}>
                    <Ico size={16}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{l.label}</div>
                      <div className="t-mono" style={{ color: "var(--ink-3)" }}>{l.v}</div>
                    </div>
                    {l.ext && <button className="icon-btn"><window.I.External size={14}/></button>}
                    {!l.ext && <span className="pill"><window.I.Lock size={11}/>reference</span>}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card card-pad-lg" style={{ gridColumn: "1 / -1" }}>
            <div className="row" style={{ marginBottom: 16 }}>
              <div className="t-eyebrow">At a glance</div>
            </div>
            <div className="grid-4">
              {[
                { label: "Rooms", v: p.rooms },
                { label: "Assets tracked", v: p.assets },
                { label: "Recurring bills", v: p.bills },
                { label: "Approved vendors", v: p.vendors },
                { label: "Open defects", v: p.pendingDefects },
                { label: "Maintenance plans", v: plans.length },
              ].map(s => (
                <div key={s.label} style={{ padding: "14px 16px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)" }}>
                  <div className="t-small">{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", marginTop: 4 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "rooms" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header">
            <span className="card-title">Rooms · {rooms.length}</span>
            <button className="btn btn-sm"><window.I.Plus size={12}/> Add room</button>
          </div>
          {rooms.map(r => {
            const open = openRoom === r.id;
            const roomAssets = assets.filter(a => a.room === r.id);
            return (
              <div key={r.id}>
                <button className="card-row clickable" onClick={() => setOpenRoom(open ? null : r.id)} style={{
                  width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--line)", background: "transparent",
                  padding: "16px 20px"
                }}>
                  <div style={{ width: 36, height: 36, background: "var(--bg-sunken)", borderRadius: 10, display: "grid", placeItems: "center" }}>
                    <window.I.Box size={16}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                    <div className="muted t-small">Floor {r.floor}<span className="dot-sep"></span>{r.area}<span className="dot-sep"></span>{roomAssets.length} assets</div>
                  </div>
                  <window.I.ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s var(--ease-out)" }}/>
                </button>
                {open && (
                  <div style={{ background: "var(--bg-sunken)", padding: "8px 20px 16px" }}>
                    {roomAssets.length === 0 ? (
                      <div className="muted t-small" style={{ padding: 16 }}>No assets logged in this room yet.</div>
                    ) : (
                      <table className="table" style={{ background: "transparent" }}>
                        <thead>
                          <tr><th>Asset</th><th>Category</th><th>Serial</th><th>Warranty</th><th>Last service</th></tr>
                        </thead>
                        <tbody>
                          {roomAssets.map(a => (
                            <tr key={a.id}>
                              <td style={{ fontWeight: 500 }}>{a.name}</td>
                              <td><span className="pill">{a.category}</span></td>
                              <td className="t-mono">{a.serial}</td>
                              <td>{a.warranty}</td>
                              <td>{a.lastService}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "assets" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Assets & systems · {assets.length}</span>
            <button className="btn btn-sm"><window.I.Plus size={12}/> Add asset</button>
          </div>
          <table className="table">
            <thead><tr><th>Asset</th><th>Category</th><th>Room</th><th>Purchased</th><th>Warranty</th><th>Last service</th></tr></thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td><span className="pill">{a.category}</span></td>
                  <td>{rooms.find(r => r.id === a.room)?.name || "—"}</td>
                  <td>{a.purchased}</td>
                  <td>{a.warranty}</td>
                  <td>{a.lastService}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "maintenance" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Maintenance plans · {plans.length}</span>
            <button className="btn btn-accent btn-sm" onClick={onAddMaintenance}><window.I.Plus size={12}/> Add plan</button>
          </div>
          <table className="table">
            <thead><tr><th>Asset</th><th>Vendor</th><th>Frequency</th><th>Next due</th><th>Expected cost</th><th>Lead</th></tr></thead>
            <tbody>
              {plans.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.assetName}</td>
                  <td>{m.vendor}</td>
                  <td><span className="pill">{m.freq}</span></td>
                  <td>{window.fmtDate(m.nextDue)}</td>
                  <td className="num">{window.fmtMoney(m.expectedCost, m.currency)}</td>
                  <td>{m.lead}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "utilities" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recurring bills</span>
          </div>
          <table className="table">
            <thead><tr><th>Payee</th><th>Category</th><th>Frequency</th><th>Method</th><th>Next due</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.payee}</td>
                  <td><span className="pill">{b.category}</span></td>
                  <td>{b.freq}</td>
                  <td className="muted">{b.method}</td>
                  <td>{window.fmtDate(b.nextDue)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{window.fmtMoney(b.amount, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "defects" && (
        <div className="empty card" style={{ padding: 80 }}>
          <window.I.Wrench size={28}/>
          <div style={{ marginTop: 12 }} className="t-h2">{p.pendingDefects} open defect{p.pendingDefects === 1 ? "" : "s"}</div>
          <div style={{ marginTop: 4 }}>Linked to vendors via Todoist · open in the Tasks view for full timeline.</div>
        </div>
      )}

      {tab === "documents" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Documents</span>
            <button className="btn btn-sm"><window.I.External size={12}/> Open in Drive</button>
          </div>
          {window.DATA.documents.filter(d => d.property === p.id).map(d => (
            <div className="card-row clickable" key={d.id}>
              <window.I.Documents size={18}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</div>
                <div className="muted t-small">{d.category}<span className="dot-sep"></span>{d.access}{d.expiry !== "—" && <><span className="dot-sep"></span>expires {d.expiry}</>}</div>
              </div>
              <window.I.External size={14}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.Properties = Properties;
window.PropertyBible = PropertyBible;

// Lightweight views for the other modules + mobile parity

function PeopleView() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>HR</div>
        <div className="t-title">People</div>
      </header>
      <div className="card">
        <div className="card-header"><span className="card-title">Household team · {window.DATA.people.length}</span></div>
        {window.DATA.people.map(p => (
          <div className="card-row clickable" key={p.id}>
            <div className="avatar avatar-lg" style={{ background: p.color }}>{p.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{p.name}</div>
              <div className="muted t-small">{p.role}</div>
            </div>
            {p.id === "siti" && <span className="pill pill-warn"><window.I.Alert size={11}/>Work permit · 50d</span>}
            <window.I.ChevronRight size={14}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorsView() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Directory</div>
        <div className="t-title">Vendors</div>
      </header>
      <div className="card">
        <div className="card-header"><span className="card-title">Approved vendors · {window.DATA.vendors.length}</span></div>
        <table className="table">
          <thead><tr><th>Vendor</th><th>Trade</th><th>Properties</th><th>NDA</th><th>Insurance</th><th>Rating</th></tr></thead>
          <tbody>
            {window.DATA.vendors.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: 500 }}>
                  {v.name}
                  {v.warning && <div className="t-small" style={{ color: "var(--warn)" }}>{v.warning}</div>}
                </td>
                <td>{v.trade}</td>
                <td>{v.properties.map(p => window.DATA.properties.find(x => x.id === p)?.name).join(" · ")}</td>
                <td>{v.ndaUntil}</td>
                <td>{v.insuranceUntil}</td>
                <td>★ {v.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocumentsView() {
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const all = [...window.DATA.documents, ...window.INVENTORY.documents];
  const cats = ["Receipt", "Invoice", "Warranty", "Appraisal", "Statement", "Insurance", "Service", "Legal", "HR"];
  const filtered = all.filter(d => {
    if (filter !== "all" && d.category !== filter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="page fade-in" style={{ maxWidth: 1280, padding: "32px 32px 80px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Evidence store · in-house</div>
          <div className="t-title">Documents</div>
          <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
            Originals are immutable. Extracted data is versioned. Attach to assets, transactions, properties or people.
          </div>
        </div>
        <button className="btn btn-accent"><window.I.Plus size={14}/>Upload</button>
      </header>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="t-small">Total documents</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">{window.INVENTORY.backup.entityCounts.documents.toLocaleString()}</div>
          <div className="t-small" style={{ marginTop: 4 }}>S3 · eu-west-1</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Storage used</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">2.4 GB</div>
          <div className="t-small" style={{ marginTop: 4 }}>incl. parse-run versions</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Parse runs · 30d</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">182</div>
          <div className="t-small" style={{ marginTop: 4 }}>Agent-extracted line items</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Line items · 30d</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">410</div>
          <div className="t-small" style={{ marginTop: 4 }}>Pending → asset · 6</div>
        </div>
      </div>

      <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <window.I.Search size={14} style={{ color: "var(--ink-3)" }}/>
          <input
            className="input"
            style={{ border: 0, background: "transparent", padding: 0, height: 26 }}
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="segmented">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
            {cats.map(c => (
              <button key={c} className={filter === c ? "active" : ""} onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th></th><th>Document</th><th>Category</th><th>Attached to</th><th>Source</th><th>Size</th><th>Uploaded</th></tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={{ width: 40 }}>
                  <div style={{ width: 32, height: 36, background: "var(--bg-sunken)", borderRadius: 6, display: "grid", placeItems: "center" }}>
                    <window.I.Documents size={14} style={{ color: "var(--ink-3)" }}/>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{d.name}</div>
                  <div className="muted t-small">
                    {d.immutable && <><window.I.Lock size={10} style={{ verticalAlign: -1 }}/> immutable original</>}
                    {d.parseRuns > 0 && <><span className="dot-sep"></span>{d.parseRuns} parse run · {d.lineItems} line items</>}
                  </div>
                </td>
                <td><span className="pill">{d.category}</span></td>
                <td>
                  {d.attachedTo ? (
                    <>
                      <div className="t-small" style={{ color: "var(--ink-4)" }}>{d.attachedTo.type}</div>
                      <div style={{ fontSize: 13 }}>{d.attachedTo.label}</div>
                    </>
                  ) : (d.property ? window.DATA.properties.find(p => p.id === d.property)?.name : "—")}
                </td>
                <td>{d.source === "agent" ? <span className="agent-ribbon"><span className="agent-glyph"></span>agent</span> : "manual"}</td>
                <td>{d.size}</td>
                <td>{window.fmtDate(d.uploaded)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TasksView() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Todoist · system of record</div>
        <div className="t-title">Tasks</div>
      </header>
      <div className="card">
        {[
          { who: "Marcia", what: "Receive Waitrose delivery (11:00–12:00)", when: "Tue 26 May", proj: "Wardian", maintenance: false },
          { who: "Marcia", what: "Be present for HVAC service (access)", when: "Thu 28 May", proj: "Wardian", maintenance: true },
          { who: "Lorna", what: "Renew TV Licence before 14 July", when: "07 Jul", proj: "Wardian", maintenance: false },
          { who: "Siti", what: "Pool filter service — be present", when: "04 Jun", proj: "Singapore", maintenance: true },
          { who: "Toby", what: "Review Q2 maintenance variance", when: "Today", proj: "Finance", maintenance: false, overdue: false },
        ].map((t, i) => (
          <div className="card-row" key={i}>
            <div style={{
              width: 18, height: 18, borderRadius: 999, border: "1.5px solid var(--line-strong)",
            }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{t.what}</div>
              <div className="muted t-small">
                {t.proj}<span className="dot-sep"></span>assignee {t.who}{t.maintenance && <><span className="dot-sep"></span>maintenance</>}
              </div>
            </div>
            <span className="pill">{t.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehiclesView() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Registry</div>
        <div className="t-title">Vehicles</div>
      </header>
      <div className="grid-2">
        {[
          { name: "Range Rover Velar D300", reg: "LV21 XYZ", colour: "Carpathian Grey", garage: "Wardian", mot: "2026-09-12", tax: "2026-11-01", ins: "2026-07-04" },
          { name: "BMW iX xDrive50", reg: "SBQ 4421", colour: "Mineral White", garage: "Singapore", mot: "—", tax: "2027-02-04", ins: "2026-10-22" },
        ].map(v => (
          <div className="card card-pad-lg" key={v.reg}>
            <div className="t-eyebrow" style={{ marginBottom: 14 }}>{v.garage}</div>
            <div className="t-h2">{v.name}</div>
            <div className="muted t-small" style={{ marginBottom: 18 }}>{v.colour}<span className="dot-sep"></span>{v.reg}</div>
            <dl className="meta-grid" style={{ gridTemplateColumns: "100px 1fr", fontSize: 13 }}>
              <dt>MOT</dt><dd>{v.mot}</dd>
              <dt>Tax</dt><dd>{v.tax}</dd>
              <dt>Insurance</dt><dd>{v.ins}</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectoryView() {
  return (
    <div className="page fade-in">
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Communications</div>
        <div className="t-title">Directory</div>
      </header>
      <div className="grid-2">
        <div className="card card-pad-lg">
          <div className="t-eyebrow" style={{ marginBottom: 14 }}>Operational mailboxes</div>
          <dl className="meta-grid">
            <dt>deliveries@</dt><dd className="t-mono">deliveries@kanzen.family</dd>
            <dt>accounts@</dt><dd className="t-mono">accounts@kanzen.family</dd>
            <dt>house@</dt><dd className="t-mono">house@kanzen.family</dd>
            <dt>vendors@</dt><dd className="t-mono">vendors@kanzen.family</dd>
            <dt>concierge@</dt><dd className="t-mono">concierge@kanzen.family</dd>
          </dl>
        </div>
        <div className="card card-pad-lg">
          <div className="t-eyebrow" style={{ marginBottom: 14 }}>Role addresses</div>
          <dl className="meta-grid">
            <dt>Principal</dt><dd className="t-mono">toby@kanzen.family</dd>
            <dt>Chief of Staff</dt><dd className="t-mono">lorna@kanzen.family</dd>
            <dt>Wardian</dt><dd className="t-mono">wardian@kanzen.family</dd>
            <dt>Singapore</dt><dd className="t-mono">singapore@kanzen.family</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  const [tab, setTab] = React.useState("integrations");
  return (
    <div className="page fade-in" style={{ maxWidth: 1320 }}>
      <header style={{ marginBottom: 24 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>System</div>
        <div className="t-title">Settings</div>
      </header>
      <div className="tabs">
        <button className={tab === "integrations" ? "active" : ""} onClick={() => setTab("integrations")}>Integrations</button>
        <button className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>Permissions</button>
        <button className={tab === "preferences" ? "active" : ""} onClick={() => setTab("preferences")}>Preferences</button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit log</button>
      </div>

      {tab === "integrations" && (
        <div className="grid-2">
          <div className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 14 }}>Connected systems</div>
            <div className="col" style={{ gap: 10 }}>
              {[
                { name: "Gmail · operational inboxes", status: "Connected · 5 mailboxes", icon: "Gmail" },
                { name: "Todoist", status: "Connected · webhook live", icon: "Todoist" },
                { name: "Google Calendar", status: "Two-way sync · 4 calendars", icon: "Calendar" },
                { name: "Google Drive", status: "2 shared drives indexed", icon: "Drive" },
                { name: "Amazon Bedrock · Claude", status: "Active · eu-west-2", icon: "Sparkle" },
                { name: "AWS SES", status: "Notifications · verified", icon: "Mail" },
                { name: "1Password", status: "Reference only · 7 vaults", icon: "Lock" },
              ].map(i => {
                const Ico = window.I[i.icon];
                return (
                  <div key={i.name} className="row" style={{ padding: "12px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)" }}>
                    <Ico size={16}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{i.name}</div>
                      <div className="t-small">{i.status}</div>
                    </div>
                    <span className="pill pill-positive"><span className="pill-dot"></span>OK</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 14 }}>System summary</div>
            <dl className="meta-grid">
              <dt>Backend</dt><dd>Scala · Tapir (OpenAPI)</dd>
              <dt>Database</dt><dd>PostgreSQL · RDS</dd>
              <dt>LLM</dt><dd>Claude on Bedrock</dd>
              <dt>Region</dt><dd>eu-west-2 (London)</dd>
              <dt>Compute</dt><dd>ECS Fargate</dd>
              <dt>Mobile</dt><dd>Flutter · 1.2.4</dd>
              <dt>Web</dt><dd>React + StyleX · 2026.05</dd>
            </dl>
          </div>
        </div>
      )}

      {tab === "permissions" && <PermissionsMatrix/>}

      {tab === "preferences" && (
        <div className="grid-2">
          <div className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 14 }}>Financial</div>
            <dl className="meta-grid">
              <dt>Approval threshold · UK</dt><dd>£1,500.00</dd>
              <dt>Approval threshold · SG</dt><dd>S$2,500.00</dd>
              <dt>Display currency</dt><dd>Native (no conversion)</dd>
              <dt>Variance flag</dt><dd>±15% vs previous</dd>
              <dt>Bill lead reminders</dt><dd>5 days before due</dd>
            </dl>
          </div>
          <div className="card card-pad-lg">
            <div className="t-eyebrow" style={{ marginBottom: 14 }}>Security</div>
            <dl className="meta-grid">
              <dt>MFA</dt><dd>Required · all users</dd>
              <dt>Session</dt><dd>4 hours · auto sign-out</dd>
              <dt>Backup</dt><dd>Daily RDS snapshots · 30d retention</dd>
              <dt>Audit retention</dt><dd>7 years</dd>
              <dt>Email content</dt><dd>Stays in AWS · Bedrock</dd>
            </dl>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Audit log · last 24h</span>
            <span className="t-small">Visible to Principal only</span>
          </div>
          {[
            { at: "10:14", actor: "Agent", what: "Auto-executed delivery proposal", target: "Amazon · 21 May", kind: "agent" },
            { at: "10:02", actor: "Lorna", what: "Updated maintenance plan", target: "Daikin VRV-IV · lead 14d → 21d", kind: "user" },
            { at: "09:42", actor: "Lorna", what: "Confirmed agent proposal", target: "Hairdresser · 23 May", kind: "user" },
            { at: "08:14", actor: "Agent", what: "Classified inbound email", target: "Waitrose delivery", kind: "agent" },
            { at: "07:42", actor: "Agent", what: "Reconciled invoice · flagged variance", target: "SP Group · S$612.80", kind: "agent" },
            { at: "06:30", actor: "Marcia", what: "Marked task complete (Todoist)", target: "Living room — deep clean", kind: "staff" },
            { at: "Yesterday 19:11", actor: "Agent", what: "Filed document to Drive", target: "Coutts · April statement.pdf", kind: "agent" },
          ].map((l, i) => (
            <div key={i} className="card-row">
              <span className="t-mono" style={{ width: 100, fontSize: 11.5, color: "var(--ink-4)" }}>{l.at}</span>
              <span className="pill" style={{
                width: 70, justifyContent: "center",
                background: l.kind === "agent" ? "var(--accent-soft)" : "var(--bg-sunken)",
                color: l.kind === "agent" ? "var(--accent)" : "var(--ink-2)",
              }}>{l.actor}</span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{l.what}</span>
              <span className="muted t-small">{l.target}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionsMatrix() {
  const { roles, modules, permissions } = window.DATA;
  const [edits, setEdits] = React.useState({});
  const cycle = ["none", "read", "write", "admin"];
  function getLevel(modId, ri) {
    return edits[modId + ":" + ri] ?? permissions[modId][ri];
  }
  function setLevel(modId, ri, lvl) {
    setEdits({ ...edits, [modId + ":" + ri]: lvl });
  }
  function cycleLevel(modId, ri) {
    const cur = getLevel(modId, ri);
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    setLevel(modId, ri, next);
  }

  const groups = {};
  modules.forEach(m => {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });

  const levelStyle = {
    none: { bg: "var(--bg-sunken)", fg: "var(--ink-4)", label: "—", border: "var(--line)" },
    read: { bg: "var(--bg-sunken)", fg: "var(--ink-2)", label: "Read", border: "var(--line-strong)" },
    write: { bg: "var(--accent-soft)", fg: "var(--accent)", label: "Write", border: "transparent" },
    admin: { bg: "var(--ink)", fg: "var(--bg)", label: "Admin", border: "transparent" },
  };

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="card card-pad-lg">
        <div className="row" style={{ marginBottom: 8 }}>
          <window.I.Lock size={16} style={{ color: "var(--accent)" }}/>
          <div className="t-h2">Role + property scope</div>
        </div>
        <div className="muted t-body" style={{ maxWidth: 720, marginBottom: 18 }}>
          Permissions are enforced server-side on every request. Each role has a property scope · staff are limited to their assigned property, the future Singapore lead sees only Singapore, the Manager sees everything except the Principal's private records.
        </div>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          {Object.entries(levelStyle).map(([k, v]) => (
            <div key={k} className="row" style={{ gap: 8 }}>
              <span style={{
                background: v.bg, color: v.fg,
                padding: "3px 10px", borderRadius: 6,
                fontSize: 11.5, fontWeight: 600,
                border: "1px solid " + v.border,
              }}>{v.label}</span>
              <span className="t-small">
                {k === "none" && "No visibility"}
                {k === "read" && "View only"}
                {k === "write" && "Create + edit"}
                {k === "admin" && "Full · incl. delete"}
              </span>
            </div>
          ))}
          <span className="spacer"></span>
          <span className="t-small">Click any cell to cycle</span>
        </div>
      </div>

      {/* The matrix */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: "left", padding: "16px 20px",
                  position: "sticky", left: 0, background: "var(--bg-elev)",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 11, fontWeight: 600, color: "var(--ink-4)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  zIndex: 2,
                  minWidth: 260,
                }}>Module</th>
                {roles.map(r => (
                  <th key={r.id} style={{
                    padding: "14px 12px",
                    borderBottom: "1px solid var(--line)",
                    minWidth: 140,
                    textAlign: "left",
                  }}>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: r.color }}>
                        {r.person.split(" · ")[0].split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{r.name}</div>
                        <div className="t-small" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{r.person}</div>
                        {r.scope && <div className="t-small" style={{ fontSize: 10, color: "var(--accent)" }}>{r.scope}</div>}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, mods]) => (
                <React.Fragment key={group}>
                  <tr>
                    <td colSpan={roles.length + 1} style={{
                      padding: "16px 20px 6px",
                      fontSize: 10.5, fontWeight: 600,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--ink-4)",
                      background: "var(--bg)",
                    }}>{group}</td>
                  </tr>
                  {mods.map(m => (
                    <tr key={m.id}>
                      <td style={{
                        padding: "10px 20px",
                        position: "sticky", left: 0, background: "var(--bg-elev)",
                        borderBottom: "1px solid var(--line)",
                        zIndex: 1,
                      }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                          {m.restricted && <window.I.Lock size={11} style={{ color: "var(--ink-4)" }}/>}
                        </div>
                      </td>
                      {roles.map((r, ri) => {
                        const lvl = getLevel(m.id, ri);
                        const s = levelStyle[lvl];
                        return (
                          <td key={ri} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
                            <button
                              onClick={() => cycleLevel(m.id, ri)}
                              style={{
                                background: s.bg, color: s.fg,
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 11.5, fontWeight: 600,
                                border: "1px solid " + s.border,
                                minWidth: 60, cursor: "pointer",
                                transition: "all .15s var(--ease-out)",
                              }}>{s.label}</button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row">
          <window.I.Sparkle size={16} style={{ color: "var(--ink-3)" }}/>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Property scope is independent of role. A staff member with <strong>write</strong> on Lists sees only their assigned property's lists.
          </div>
          <span className="spacer"></span>
          {Object.keys(edits).length > 0 && (
            <>
              <span className="t-small">{Object.keys(edits).length} unsaved change{Object.keys(edits).length === 1 ? "" : "s"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdits({})}>Reset</button>
              <button className="btn btn-accent btn-sm"><window.I.Check size={13}/>Save</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.PeopleView = PeopleView;
window.VendorsView = VendorsView;
window.DocumentsView = DocumentsView;
window.TasksView = TasksView;
window.VehiclesView = VehiclesView;
window.DirectoryView = DirectoryView;
window.SettingsView = SettingsView;

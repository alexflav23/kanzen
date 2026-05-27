// App shell — sidebar, topbar, view routing
function App() {
  const [view, setView] = React.useState("dashboard");
  const [theme, setTheme] = React.useState("light");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(null);
  const [mobile, setMobile] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    window.__toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && e.shiftKey) { e.preventDefault(); window.__toggleTheme(); }
      if (e.key === "Escape") { setSearchOpen(false); setMaintenanceOpen(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function showToast(msg, kind = "success") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  const inboxCount = window.DATA.triage.length
    + window.INVENTORY.reconciliation.filter(r => r.state === "unmatched" || r.state === "suggested").length;
  const approvalCount = window.DATA.expenses.filter(e => e.status === "Pending Approval").length;
  const listApprovalCount = window.DATA.lists.reduce((s, l) => s + l.items.filter(i => i.status === "needs_approval").length, 0);

  const nav = [
    {
      section: null, items: [
        { id: "dashboard", label: "Dashboard", icon: "Dashboard" },
        { id: "inbox", label: "Inbox", icon: "Inbox", count: inboxCount, accent: true },
      ]
    },
    {
      section: "Inventory", items: [
        { id: "assets", label: "Inventory", icon: "Box" },
        { id: "collections", label: "Collections", icon: "Layers" },
        { id: "insights", label: "Insights", icon: "PieChart" },
      ]
    },
    {
      section: "Operations", items: [
        { id: "properties", label: "Properties", icon: "Property" },
        { id: "tasks", label: "Tasks", icon: "Tasks", external: true },
        { id: "calendar", label: "Calendar", icon: "Calendar", external: true },
        { id: "lists", label: "Lists", icon: "Receipt", count: listApprovalCount, accent: true },
        { id: "maintenance", label: "Maintenance", icon: "Wrench" },
      ]
    },
    {
      section: "Records", items: [
        { id: "people", label: "People", icon: "People" },
        { id: "vendors", label: "Vendors", icon: "Vendors" },
        { id: "vehicles", label: "Vehicles", icon: "Vehicle" },
        { id: "documents", label: "Documents", icon: "Documents" },
      ]
    },
    {
      section: "Finance & system", items: [
        { id: "finance", label: "Finance", icon: "Finance", warn: approvalCount },
        { id: "backup", label: "Backup", icon: "Database" },
        { id: "directory", label: "Directory", icon: "Directory" },
        { id: "settings", label: "Settings", icon: "Settings" },
      ]
    },
  ];

  function activeId() {
    if (view.startsWith("property:")) return "properties";
    if (view.startsWith("asset:")) return "assets";
    if (view.startsWith("collection:")) return "collections";
    return view;
  }

  function renderView() {
    if (mobile) return <window.MobileView/>;
    if (view === "dashboard") return <window.Dashboard onNav={setView} onOpenTriage={() => setView("inbox")}/>;
    if (view === "inbox") return <window.InboxView/>;
    if (view === "triage") return <window.Triage/>;
    if (view === "assets") return <window.AssetsView onOpenAsset={(id) => setView("asset:" + id)}/>;
    if (view.startsWith("asset:")) {
      const id = view.split(":")[1];
      return <window.AssetDetail assetId={id} onBack={() => setView("assets")}/>;
    }
    if (view === "collections") return <window.CollectionsView onOpenAsset={(id) => setView("asset:" + id)}/>;
    if (view === "insights") return <window.InsightsView/>;
    if (view === "properties") return <window.Properties onOpen={(id) => setView("property:" + id)}/>;
    if (view.startsWith("property:")) {
      const id = view.split(":")[1];
      return <window.PropertyBible propId={id} onBack={() => setView("properties")} onAddMaintenance={() => setMaintenanceOpen(id)}/>;
    }
    if (view === "finance") return <window.Finance onApprove={(e) => showToast("Approved · " + window.fmtMoney(e.amount, e.currency))} onReject={() => showToast("Sent back for revision", "muted")}/>;
    if (view === "calendar") return <window.CalendarView/>;
    if (view === "lists") return <window.ListsView/>;
    if (view === "backup") return <window.BackupView/>;
    if (view === "people") return <window.PeopleView/>;
    if (view === "vendors") return <window.VendorsView/>;
    if (view === "documents") return <window.DocumentsView/>;
    if (view === "tasks") return <window.TasksView/>;
    if (view === "vehicles") return <window.VehiclesView/>;
    if (view === "directory") return <window.DirectoryView/>;
    if (view === "settings") return <window.SettingsView/>;
    if (view === "maintenance") return (
      <div className="page fade-in">
        <header style={{ marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Cross-property</div>
          <div className="t-title">Maintenance plans</div>
        </header>
        <div className="card">
          <div className="card-header">
            <span className="card-title">All plans · {window.DATA.maintenancePlans.length}</span>
            <button className="btn btn-accent btn-sm" onClick={() => setMaintenanceOpen("wardian")}>
              <window.I.Plus size={12}/>Add plan
            </button>
          </div>
          <table className="table">
            <thead><tr><th>Asset</th><th>Property</th><th>Vendor</th><th>Frequency</th><th>Next due</th><th>Lead</th><th style={{textAlign:"right"}}>Expected</th></tr></thead>
            <tbody>
              {window.DATA.maintenancePlans.map(m => {
                const p = window.DATA.properties.find(x => x.id === m.property);
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.assetName}</td>
                    <td>{p?.name}</td>
                    <td>{m.vendor}</td>
                    <td><span className="pill">{m.freq}</span></td>
                    <td>{window.fmtDate(m.nextDue)}</td>
                    <td>{m.lead}d</td>
                    <td className="num" style={{ textAlign: "right" }}>{window.fmtMoney(m.expectedCost, m.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
    return null;
  }

  return (
    <div className="app" style={mobile ? { gridTemplateColumns: "1fr" } : {}}>
      {!mobile && (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">完</div>
            <div className="brand-name">Kanzen</div>
            <span className="spacer"></span>
          </div>

          {nav.map((group, gi) => (
            <div className="nav-section" key={gi}>
              {group.section && <div className="nav-label">{group.section}</div>}
              {group.items.map(item => {
                const Ico = window.I[item.icon];
                const active = activeId() === item.id;
                return (
                  <button
                    key={item.id}
                    className={"nav-item " + (active ? "active" : "")}
                    onClick={() => setView(item.id)}
                  >
                    <Ico className="nav-icon"/>
                    <span>{item.label}</span>
                    {item.count > 0 && item.accent && <span className="nav-dot"/>}
                    {item.warn > 0 && (
                      <span style={{
                        marginLeft: "auto",
                        background: "var(--warn-soft)", color: "var(--warn)",
                        fontSize: 10.5, fontWeight: 600,
                        borderRadius: 999, padding: "1px 7px",
                      }}>{item.warn}</span>
                    )}
                    {item.external && !item.warn && !active && (
                      <window.I.External size={12} style={{ marginLeft: "auto", color: "var(--ink-4)" }}/>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="spacer"></div>

          <div style={{
            background: "var(--bg-elev)",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid var(--line)",
          }}>
            <div className="row">
              <div className="avatar">{window.DATA.user.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{window.DATA.user.name}</div>
                <div className="t-small" style={{ fontSize: 11 }}>{window.DATA.user.role}</div>
              </div>
              <button className="icon-btn" onClick={() => window.__toggleTheme()}>
                {theme === "light" ? <window.I.Moon size={14}/> : <window.I.Sun size={14}/>}
              </button>
            </div>
          </div>
        </aside>
      )}

      <main className="main">
        <div className="topbar">
          {!mobile && (
            <button className="search" onClick={() => setSearchOpen(true)}>
              <window.I.Search size={14}/>
              <span>Search Kanzen…</span>
              <span className="kbd">⌘K</span>
            </button>
          )}
          <span className="spacer"></span>
          <button className={"btn btn-sm " + (mobile ? "btn-accent" : "")} onClick={() => setMobile(m => !m)}>
            <window.I.Phone size={14}/>
            {mobile ? "Back to web" : "Mobile preview"}
          </button>
          <button className="icon-btn">
            <window.I.Bell size={16}/>
          </button>
        </div>

        <div className="content">
          {renderView()}
        </div>
      </main>

      {searchOpen && <window.SearchPalette onClose={() => setSearchOpen(false)} onNav={setView}/>}
      {maintenanceOpen && (
        <window.AddMaintenanceModal
          propId={maintenanceOpen}
          onClose={() => setMaintenanceOpen(null)}
          onSave={() => { setMaintenanceOpen(null); showToast("Maintenance plan created · Todoist task scheduled"); }}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--bg)",
          padding: "12px 18px", borderRadius: 999,
          fontSize: 13, fontWeight: 500,
          boxShadow: "var(--shadow-pop)",
          zIndex: 200,
          display: "flex", alignItems: "center", gap: 8,
          animation: "modalIn .22s var(--ease-out)",
        }}>
          {toast.kind === "success" && <window.I.Check size={14}/>}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);

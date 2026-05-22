// Cmd-K global search
function SearchPalette({ onClose, onNav }) {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build search corpus
  const all = React.useMemo(() => {
    const out = [];
    window.DATA.properties.forEach(p => out.push({ type: "Property", icon: "Property", id: "property:" + p.id, label: p.name, sub: p.address, view: "property:" + p.id }));
    window.DATA.people.forEach(p => out.push({ type: "Person", icon: "People", id: "person:" + p.id, label: p.name, sub: p.role, view: "people" }));
    window.DATA.vendors.forEach(v => out.push({ type: "Vendor", icon: "Vendors", id: "vendor:" + v.id, label: v.name, sub: v.trade, view: "vendors" }));
    window.DATA.bills.forEach(b => out.push({ type: "Bill", icon: "Finance", id: "bill:" + b.id, label: b.payee, sub: b.category + " · " + window.fmtMoney(b.amount, b.currency), view: "finance" }));
    window.DATA.expenses.forEach(e => out.push({ type: "Expense", icon: "Receipt", id: "exp:" + e.id, label: e.desc, sub: e.payee + " · " + window.fmtMoney(e.amount, e.currency), view: "finance" }));
    Object.entries(window.DATA.assets).forEach(([prop, list]) => list.forEach(a => out.push({ type: "Asset", icon: "Box", id: "asset:" + a.id, label: a.name, sub: a.category + " · " + (window.DATA.properties.find(p => p.id === prop)?.name), view: "property:" + prop })));
    window.DATA.documents.forEach(d => out.push({ type: "Document", icon: "Documents", id: "doc:" + d.id, label: d.name, sub: d.category + " · " + d.access, view: "documents" }));
    window.DATA.triage.forEach(t => out.push({ type: "Inbox", icon: "Inbox", id: "tri:" + t.id, label: t.subject, sub: t.category, view: "inbox" }));
    if (window.INVENTORY) {
      window.INVENTORY.assets.forEach(a => out.push({ type: "Asset", icon: a.photo?.icon || "Box", id: "ast:" + a.id, label: a.title, sub: a.maker + " · " + window.fmtMoneyShort(a.value?.current, a.currency || "GBP"), view: "asset:" + a.id }));
      window.INVENTORY.collections.forEach(c => out.push({ type: "Collection", icon: "Layers", id: "col:" + c.id, label: c.name, sub: c.members.length + " members", view: "collections" }));
    }
    return out;
  }, []);

  const filtered = React.useMemo(() => {
    if (!q.trim()) return all.slice(0, 8);
    const Q = q.toLowerCase();
    return all.filter(x => x.label.toLowerCase().includes(Q) || x.sub.toLowerCase().includes(Q)).slice(0, 30);
  }, [q, all]);

  // group by type
  const groups = {};
  filtered.forEach(f => {
    if (!groups[f.type]) groups[f.type] = [];
    groups[f.type].push(f);
  });

  const quickActions = [
    { label: "Add property",        icon: "Plus",       hint: "P" },
    { label: "Add maintenance plan",icon: "Wrench",     hint: "M" },
    { label: "Log expense",         icon: "Receipt",    hint: "E" },
    { label: "Open Triage queue",   icon: "Triage",     hint: "T",  view: "triage" },
    { label: "Toggle theme",        icon: "Sun",        hint: "⌘D", action: "toggleTheme" },
  ];

  return (
    <div className="scrim" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 680,
        maxWidth: "92%",
        background: "var(--bg-elev)",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-pop)",
        overflow: "hidden",
        animation: "modalIn .2s var(--ease-out)",
      }}>
        <div className="row" style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          gap: 12,
        }}>
          <window.I.Search size={18} style={{ color: "var(--ink-3)" }}/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search properties, vendors, bills, assets, documents…"
            style={{
              border: 0, outline: "none", background: "transparent",
              fontSize: 16, color: "var(--ink)", flex: 1,
              fontFamily: "inherit", letterSpacing: "-0.005em",
            }}
          />
          <span className="kbd" style={{
            fontSize: 11, color: "var(--ink-4)",
            background: "var(--bg-sunken)", borderRadius: 4,
            padding: "2px 6px", fontFamily: "var(--font-mono)",
          }}>esc</span>
        </div>

        <div style={{ maxHeight: 460, overflow: "auto" }}>
          {q.trim() === "" && (
            <div style={{ padding: "10px 0 6px" }}>
              <div className="t-eyebrow" style={{ padding: "8px 18px" }}>Quick actions</div>
              {quickActions.map(a => {
                const Ico = window.I[a.icon];
                return (
                  <button key={a.label} onClick={() => { if (a.view) onNav(a.view); if (a.action === "toggleTheme") window.__toggleTheme?.(); onClose(); }} style={{
                    width: "100%", border: 0, background: "transparent", padding: "10px 18px",
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    textAlign: "left",
                  }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-sunken)"}
                     onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Ico size={16}/>
                    <span style={{ fontSize: 13.5, flex: 1 }}>{a.label}</span>
                    <span className="kbd">{a.hint}</span>
                  </button>
                );
              })}
            </div>
          )}

          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="t-eyebrow" style={{ padding: "12px 18px 6px" }}>{group}</div>
              {items.map((f, i) => {
                const Ico = window.I[f.icon];
                return (
                  <button key={f.id + i} onClick={() => { onNav(f.view); onClose(); }} style={{
                    width: "100%", border: 0, background: "transparent", padding: "10px 18px",
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    textAlign: "left",
                  }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-sunken)"}
                     onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Ico size={16} style={{ color: "var(--ink-3)" }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5 }}>{f.label}</div>
                      <div className="t-small">{f.sub}</div>
                    </div>
                    <window.I.Arrow size={13} style={{ color: "var(--ink-4)" }}/>
                  </button>
                );
              })}
            </div>
          ))}

          {q.trim() !== "" && filtered.length === 0 && (
            <div className="empty">No matches for "{q}"</div>
          )}
        </div>

        <div className="row" style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg)",
          fontSize: 11, color: "var(--ink-4)",
          gap: 16,
        }}>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
          <span><span className="kbd">↵</span> open</span>
          <div className="spacer"></div>
          <span>Index includes Todoist tasks & email · last sync 4 min ago</span>
        </div>
      </div>
    </div>
  );
}

window.SearchPalette = SearchPalette;

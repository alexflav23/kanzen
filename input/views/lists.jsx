// Lists — grocery & household supplies
function ListsView() {
  const [activeId, setActiveId] = React.useState(window.DATA.lists[0].id);
  const list = window.DATA.lists.find(l => l.id === activeId);
  const [items, setItems] = React.useState(list.items);
  const [newItem, setNewItem] = React.useState("");

  React.useEffect(() => {
    setItems(window.DATA.lists.find(l => l.id === activeId).items);
  }, [activeId]);

  function toggle(id) {
    setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }
  function approve(id) {
    setItems(items.map(i => i.id === id ? { ...i, status: "added" } : i));
  }
  function remove(id) {
    setItems(items.filter(i => i.id !== id));
  }
  function add() {
    if (!newItem.trim()) return;
    setItems([...items, { id: "new" + Date.now(), name: newItem, category: "Misc", qty: 1, status: "added", recurring: false, addedBy: "Flavian" }]);
    setNewItem("");
  }

  // Group items by category
  const grouped = {};
  items.forEach(i => {
    if (!grouped[i.category]) grouped[i.category] = [];
    grouped[i.category].push(i);
  });
  const needsApproval = items.filter(i => i.status === "needs_approval");
  const recurringCount = items.filter(i => i.recurring).length;

  return (
    <div className="page fade-in" style={{ maxWidth: 1280, padding: "32px 32px 60px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Household lists</div>
          <div className="t-title">Lists</div>
          <div className="muted t-body" style={{ marginTop: 6 }}>
            Recurring shopping. Staff propose, you approve, list closes on order day and rolls forward.
          </div>
        </div>
        <button className="btn"><window.I.Plus size={14}/>New list</button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "start" }}>
        {/* Lists rail */}
        <div className="col" style={{ gap: 8, position: "sticky", top: 16 }}>
          {window.DATA.lists.map(l => {
            const active = l.id === activeId;
            const prop = window.DATA.properties.find(p => p.id === l.property);
            const needs = l.items.filter(i => i.status === "needs_approval").length;
            return (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className="card"
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  boxShadow: active ? "0 0 0 2px var(--accent-soft)" : "var(--shadow-1)",
                }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  {l.type === "grocery" ? (
                    <window.I.Box size={14} style={{ color: "var(--ink-3)" }}/>
                  ) : (
                    <window.I.Box size={14} style={{ color: "var(--ink-3)" }}/>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.name}</span>
                  <span className="spacer"></span>
                  {needs > 0 && (
                    <span className="pill pill-warn" style={{ height: 18, padding: "0 6px", fontSize: 10.5 }}>{needs}</span>
                  )}
                </div>
                <div className="t-small" style={{ fontSize: 11 }}>{l.cycle}</div>
              </button>
            );
          })}
          <button className="btn btn-ghost" style={{ marginTop: 4, justifyContent: "flex-start", padding: "10px 14px", height: "auto", color: "var(--ink-3)" }}>
            <window.I.Plus size={13}/>New list
          </button>
        </div>

        {/* List detail */}
        <div className="col" style={{ gap: 20 }}>
          {/* Header card */}
          <div className="card" style={{ padding: "22px 26px" }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>{window.DATA.properties.find(p => p.id === list.property)?.name} · {list.cycle}</div>
                <div className="t-h2" style={{ marginBottom: 4 }}>{list.name}</div>
                <div className="muted t-small">
                  Delivers via {list.vendor}<span className="dot-sep"></span>{list.assignee} manages<span className="dot-sep"></span>last order {window.fmtDate(list.lastOrder)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>Next order</div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.014em" }}>{window.fmtDayLong(list.nextOrder)}</div>
                <div className="muted t-small">{window.daysUntil(list.nextOrder)} days</div>
              </div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 6, padding: "6px 10px", background: "var(--bg-sunken)", borderRadius: 999 }}>
                <window.I.Check size={12} style={{ color: "var(--positive)" }}/>
                <span className="t-small">{items.filter(i => i.status === "added").length} confirmed</span>
              </div>
              {needsApproval.length > 0 && (
                <div className="row" style={{ gap: 6, padding: "6px 10px", background: "var(--warn-soft)", borderRadius: 999 }}>
                  <window.I.Alert size={12} style={{ color: "var(--warn)" }}/>
                  <span className="t-small" style={{ color: "var(--warn)" }}>{needsApproval.length} need approval</span>
                </div>
              )}
              <div className="row" style={{ gap: 6, padding: "6px 10px", background: "var(--bg-sunken)", borderRadius: 999 }}>
                <window.I.Sparkle size={12} style={{ color: "var(--ink-3)" }}/>
                <span className="t-small">{recurringCount} recurring</span>
              </div>
              <div className="spacer"></div>
              <button className="btn btn-sm"><window.I.External size={12}/>Open with vendor</button>
              <button className="btn btn-accent btn-sm">Place order</button>
            </div>
          </div>

          {/* Needs approval strip */}
          {needsApproval.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex" }}>
                <div style={{ width: 5, background: "var(--warn)" }}/>
                <div style={{ flex: 1 }}>
                  <div className="card-header">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="pill pill-warn"><window.I.Alert size={11}/>Items awaiting you</span>
                      <span className="t-small">Above-staple items or budget triggers</span>
                    </div>
                  </div>
                  {needsApproval.map(i => (
                    <div className="card-row" key={i.id}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{i.name}</div>
                        <div className="muted t-small">
                          {i.category}<span className="dot-sep"></span>qty {i.qty}<span className="dot-sep"></span>requested by {i.addedBy}
                          {i.price && <><span className="dot-sep"></span>est. {window.fmtMoney(i.price, i.currency)}</>}
                        </div>
                        {i.note && <div className="t-small" style={{ marginTop: 4, fontStyle: "italic" }}>"{i.note}"</div>}
                      </div>
                      <button className="btn btn-sm" onClick={() => remove(i.id)}><window.I.X size={13}/>Decline</button>
                      <button className="btn btn-accent btn-sm" onClick={() => approve(i.id)}><window.I.Check size={13}/>Approve</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Add new item */}
          <div className="card" style={{ padding: "12px 16px" }}>
            <div className="row" style={{ gap: 10 }}>
              <window.I.Plus size={16} style={{ color: "var(--ink-3)" }}/>
              <input
                className="input"
                style={{ border: 0, background: "transparent", paddingLeft: 0 }}
                placeholder="Add an item to this list…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <button className="btn btn-sm" disabled={!newItem.trim()} onClick={add}>Add</button>
            </div>
          </div>

          {/* Items by category */}
          <div className="card" style={{ padding: 0 }}>
            {Object.entries(grouped).map(([cat, catItems]) => (
              <div key={cat}>
                <div style={{
                  padding: "12px 22px 8px",
                  background: "var(--bg)",
                  borderBottom: "1px solid var(--line)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}>
                  <span className="t-eyebrow">{cat} · {catItems.length}</span>
                </div>
                {catItems.map(i => (
                  <div className="card-row" key={i.id} style={{ opacity: i.status === "needs_approval" ? 0.55 : 1 }}>
                    <button
                      className="icon-btn"
                      onClick={() => toggle(i.id)}
                      style={{
                        width: 22, height: 22,
                        border: "1.5px solid " + (i.checked ? "var(--accent)" : "var(--line-strong)"),
                        background: i.checked ? "var(--accent)" : "transparent",
                        borderRadius: 6,
                      }}>
                      {i.checked && <window.I.Check size={11} stroke="var(--accent-ink)"/>}
                    </button>
                    <div style={{ flex: 1, textDecoration: i.checked ? "line-through" : "none", color: i.checked ? "var(--ink-4)" : "var(--ink)" }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{i.name} {i.qty > 1 && <span className="muted">· ×{i.qty}</span>}</div>
                      <div className="muted t-small">
                        added by {i.addedBy}
                        {i.recurring && <><span className="dot-sep"></span>recurring</>}
                      </div>
                    </div>
                    {i.status === "needs_approval" && <span className="pill pill-warn">Needs approval</span>}
                    {i.recurring && i.status === "added" && (
                      <span className="pill" title="Auto-added on next cycle"><window.I.Sparkle size={10}/></span>
                    )}
                    <button className="icon-btn" onClick={() => remove(i.id)}><window.I.X size={14}/></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ListsView = ListsView;

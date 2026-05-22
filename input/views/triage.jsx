// Triage — email agent review queue
function Triage() {
  const [selectedId, setSelectedId] = React.useState(window.DATA.triage[0]?.id);
  const [tab, setTab] = React.useState("queue");
  const [items, setItems] = React.useState(window.DATA.triage);
  const [history, setHistory] = React.useState(window.DATA.agentHistory);
  const [editing, setEditing] = React.useState({});
  const [toast, setToast] = React.useState(null);

  const selected = items.find(i => i.id === selectedId) || items[0];

  function confirm(item) {
    const newHistory = {
      id: "h" + Date.now(),
      at: new Date().toISOString(),
      category: item.category,
      action: "Confirmed by Toby",
      title: item.subject.split("·")[0].trim(),
      outcome: item.proposedActions.map(a => a.target.split(" ")[0]).join(" + ") + " created",
    };
    setHistory([newHistory, ...history]);
    const remaining = items.filter(i => i.id !== item.id);
    setItems(remaining);
    setSelectedId(remaining[0]?.id);
    setToast({ kind: "success", msg: "Confirmed · " + item.proposedActions.length + " actions executed" });
    setTimeout(() => setToast(null), 2400);
  }
  function reject(item) {
    setHistory([{
      id: "h" + Date.now(),
      at: new Date().toISOString(),
      category: item.category,
      action: "Rejected by Toby",
      title: item.subject.split("·")[0].trim(),
      outcome: "Dismissed, sender learning",
    }, ...history]);
    const remaining = items.filter(i => i.id !== item.id);
    setItems(remaining);
    setSelectedId(remaining[0]?.id);
    setToast({ kind: "muted", msg: "Rejected · agent will learn from this" });
    setTimeout(() => setToast(null), 2400);
  }

  return (
    <div className="page fade-in" style={{ padding: "28px 32px 60px", maxWidth: 1400 }}>
      <header style={{ marginBottom: 24 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="agent-ribbon"><span className="agent-glyph"></span> Email agent</span>
        </div>
        <div className="t-title" style={{ marginBottom: 6 }}>Triage</div>
        <div className="muted t-body" style={{ maxWidth: 620 }}>
          Inbound mail the agent has classified. Confirm, edit then confirm, or reject. Financial records always require your review.
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}>
          Queue <span className="pill" style={{ marginLeft: 6, height: 18, padding: "0 6px", fontSize: 11 }}>{items.length}</span>
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
        <button className={tab === "trust" ? "active" : ""} onClick={() => setTab("trust")}>Trust settings</button>
      </div>

      {tab === "queue" && (
        items.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: "80px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
              <div className="t-h2" style={{ marginBottom: 4 }}>Inbox zero, on the agent's side.</div>
              <div>No items waiting for review. The agent will surface anything that needs you.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start" }}>
            {/* List */}
            <div className="card" style={{ padding: 0 }}>
              {items.map(item => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: active ? "var(--bg-sunken)" : "transparent",
                      border: 0,
                      borderBottom: "1px solid var(--line)",
                      padding: "16px 18px",
                      cursor: "pointer",
                      display: "block",
                      position: "relative",
                    }}
                  >
                    {active && <div style={{
                      position: "absolute", left: 0, top: 16, bottom: 16, width: 2,
                      background: "var(--accent)", borderRadius: 0,
                    }}/>}
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="pill pill-outline" style={{ fontSize: 10.5, height: 18, padding: "0 7px" }}>
                        {item.category}
                      </span>
                      {item.varianceFlag && (
                        <span className="pill pill-warn" style={{ fontSize: 10.5, height: 18, padding: "0 7px" }}>
                          <window.I.Alert size={10}/> Variance
                        </span>
                      )}
                      <span className="spacer"></span>
                      <span className="t-small">{window.relativeTime(item.received)}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4, lineHeight: 1.35 }}>
                      {item.subject}
                    </div>
                    <div className="muted t-small" style={{ fontSize: 11.5 }}>
                      {item.sender}<span className="dot-sep"></span>{item.mailbox.split("@")[0]}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            {selected && (
              <div className="card fade-in" key={selected.id}>
                {/* Header */}
                <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--line)" }}>
                  <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                    <span className="pill pill-accent">{selected.category}</span>
                    <span className="pill">
                      <window.I.Sparkle size={11}/> {Math.round(selected.confidence * 100)}% confidence
                    </span>
                    {selected.varianceFlag && (
                      <span className="pill pill-warn"><window.I.Alert size={11}/>Variance flagged</span>
                    )}
                    <span className="spacer"></span>
                    <span className="t-small">{window.relativeTime(selected.received)}</span>
                  </div>
                  <div className="t-h2" style={{ marginBottom: 6 }}>{selected.subject}</div>
                  <div className="muted t-small">
                    From {selected.sender}<span className="dot-sep"></span>to {selected.mailbox}
                  </div>
                </div>

                {/* Body excerpt */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
                  <div className="t-eyebrow" style={{ marginBottom: 10 }}>Email</div>
                  <div className="email-body">{selected.bodyExcerpt}</div>
                </div>

                {/* Extracted */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="t-eyebrow">Agent extracted</span>
                    <span className="spacer"></span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({})}>Reset</button>
                  </div>
                  <div className="kv-card">
                    {Object.entries(selected.extracted).map(([k, v]) => (
                      <div className="kv-row" key={k}>
                        <span>{k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase())}</span>
                        <input
                          className="kv-edit"
                          value={editing[k] !== undefined ? editing[k] : v}
                          onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proposed actions */}
                <div style={{ padding: "20px 24px" }}>
                  <div className="t-eyebrow" style={{ marginBottom: 12 }}>Proposed actions · {selected.proposedActions.length}</div>
                  <div className="col" style={{ gap: 10 }}>
                    {selected.proposedActions.map((a, i) => (
                      <div key={i} className="row" style={{
                        padding: "14px 16px",
                        background: "var(--bg-sunken)",
                        borderRadius: "var(--r-md)",
                        gap: 12,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: "var(--bg-elev)",
                          display: "grid", placeItems: "center",
                          border: "1px solid var(--line)",
                        }}>
                          {a.type.startsWith("create_event") && <window.I.Calendar size={15}/>}
                          {a.type.startsWith("create_task") && <window.I.Todoist size={15}/>}
                          {a.type.startsWith("file_document") && <window.I.Drive size={15}/>}
                          {a.type.startsWith("reconcile_bill") && <window.I.Finance size={15}/>}
                          {a.type.startsWith("set_reminder") && <window.I.Bell size={15}/>}
                          {a.type.startsWith("link_plan") && <window.I.Wrench size={15}/>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.title}</div>
                          <div className="muted t-small">{a.target}{a.assignee && <><span className="dot-sep"></span>assign to {a.assignee}</>}{a.time && <><span className="dot-sep"></span>{a.time}</>}{a.note && <><span className="dot-sep"></span>{a.note}</>}</div>
                        </div>
                        <button className="icon-btn"><window.I.Edit size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: "16px 24px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--bg)",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}>
                  <button className="btn" onClick={() => reject(selected)}>
                    <window.I.X size={14}/> Reject
                  </button>
                  <button className="btn">
                    <window.I.Edit size={14}/> Edit & confirm
                  </button>
                  <div className="spacer"></div>
                  <span className="muted t-small">⌘↵ to confirm</span>
                  <button className="btn btn-accent" onClick={() => confirm(selected)}>
                    <window.I.Check size={14}/> Confirm · execute {selected.proposedActions.length}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {tab === "history" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent actions</span>
            <span className="t-small muted">Auto and confirmed actions, last 7 days</span>
          </div>
          {history.map(h => (
            <div className="card-row" key={h.id}>
              <div style={{
                width: 8, height: 8, borderRadius: 999,
                background: h.action.startsWith("Auto") ? "var(--accent)" : (h.action.startsWith("Rejected") ? "var(--ink-4)" : "var(--positive)"),
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{h.title}</div>
                <div className="muted t-small">
                  {h.category}<span className="dot-sep"></span>{h.action}<span className="dot-sep"></span>{h.outcome}
                </div>
              </div>
              <span className="t-small">{window.relativeTime(h.at)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "trust" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Per-category routing</span>
            <span className="t-small muted">Auto-executed items still notify and audit. Financial categories cannot be auto-executed.</span>
          </div>
          {window.DATA.trustSettings.map(t => (
            <div className="card-row" key={t.category}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.category}</div>
                {t.note && <div className="muted t-small">{t.note}</div>}
              </div>
              <div className="segmented">
                <button className={t.routing === "review" ? "active" : ""}>Review</button>
                <button
                  className={t.routing === "auto" ? "active" : ""}
                  disabled={t.category === "Bill / Invoice"}
                  style={t.category === "Bill / Invoice" ? { opacity: 0.45, cursor: "not-allowed" } : {}}
                >Auto</button>
              </div>
            </div>
          ))}
        </div>
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

window.Triage = Triage;

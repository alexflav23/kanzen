// Add maintenance plan — 3-step modal
function AddMaintenanceModal({ propId, onClose, onSave }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({
    asset: "",
    vendor: "Hudson Sandler",
    frequency: "Quarterly",
    firstDue: "2026-06-12",
    leadDays: 14,
    expectedCost: "",
    currency: propId === "singapore" ? "SGD" : "GBP",
    note: "",
    todoistSync: true,
  });
  const prop = window.DATA.properties.find(p => p.id === propId);
  const assets = window.DATA.assets[propId] || [];
  const vendors = window.DATA.vendors.filter(v => v.properties.includes(propId));

  function next() { setStep(s => Math.min(3, s + 1)); }
  function back() { setStep(s => Math.max(1, s - 1)); }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 4 }}>{prop.name} · Maintenance plan</div>
            <div className="t-h2">New plan</div>
          </div>
          <button className="icon-btn" onClick={onClose}><window.I.X size={16}/></button>
        </div>

        {/* Stepper */}
        <div style={{ padding: "12px 22px 0", display: "flex", gap: 4 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: n <= step ? "var(--accent)" : "var(--bg-sunken)",
              transition: "background .25s var(--ease-out)",
            }}/>
          ))}
        </div>
        <div className="t-small" style={{ padding: "8px 22px 0" }}>
          Step {step} of 3 · {step === 1 ? "Asset & vendor" : step === 2 ? "Schedule" : "Review"}
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="col" style={{ gap: 18 }}>
              <label className="field">
                <span className="field-label">Asset or system</span>
                <select
                  className="input"
                  value={form.asset}
                  onChange={(e) => setForm({ ...form, asset: e.target.value })}
                >
                  <option value="">Select asset…</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  <option value="other">Other / not in inventory</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Vendor</span>
                <select
                  className="input"
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                >
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name} · {v.trade}</option>)}
                  <option value="other">Add new vendor…</option>
                </select>
                <div className="t-small" style={{ marginTop: 4 }}>
                  Restricted to vendors approved for {prop.name}.
                </div>
              </label>
              <label className="field">
                <span className="field-label">Notes (optional)</span>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="e.g. include filter change, photograph readings"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="col" style={{ gap: 18 }}>
              <label className="field">
                <span className="field-label">Frequency</span>
                <div className="segmented" style={{ alignSelf: "flex-start" }}>
                  {["Monthly","Quarterly","Semi-annually","Annually"].map(f => (
                    <button key={f} className={form.frequency === f ? "active" : ""} onClick={() => setForm({ ...form, frequency: f })}>{f}</button>
                  ))}
                </div>
              </label>
              <div className="grid-2">
                <label className="field">
                  <span className="field-label">First due</span>
                  <input className="input" type="date" value={form.firstDue} onChange={(e) => setForm({ ...form, firstDue: e.target.value })}/>
                </label>
                <label className="field">
                  <span className="field-label">Reminder lead (days)</span>
                  <input className="input" type="number" value={form.leadDays} onChange={(e) => setForm({ ...form, leadDays: e.target.value })}/>
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span className="field-label">Expected cost</span>
                  <input className="input" type="number" placeholder="0" value={form.expectedCost} onChange={(e) => setForm({ ...form, expectedCost: e.target.value })}/>
                </label>
                <label className="field">
                  <span className="field-label">Currency</span>
                  <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option>GBP</option><option>SGD</option>
                  </select>
                </label>
              </div>
              <label className="row" style={{ gap: 10, padding: "12px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.todoistSync} onChange={(e) => setForm({ ...form, todoistSync: e.target.checked })}/>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Create recurring Todoist task</div>
                  <div className="t-small">Auto-creates a "service" task in the {prop.name} project on the same cadence.</div>
                </div>
                <window.I.Todoist size={18}/>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="col" style={{ gap: 16 }}>
              <div className="kv-card" style={{ padding: "18px 20px" }}>
                {[
                  { k: "Property", v: prop.name },
                  { k: "Asset", v: assets.find(a => a.id === form.asset)?.name || "—" },
                  { k: "Vendor", v: form.vendor },
                  { k: "Frequency", v: form.frequency },
                  { k: "First due", v: window.fmtDate(form.firstDue) },
                  { k: "Reminder", v: form.leadDays + " days ahead" },
                  { k: "Expected", v: form.expectedCost ? window.fmtMoney(parseFloat(form.expectedCost), form.currency) : "—" },
                  { k: "Todoist", v: form.todoistSync ? "Recurring task will be created" : "Not synced" },
                ].map(r => (
                  <div className="kv-row" key={r.k}>
                    <span>{r.k}</span>
                    <span className="kv-val">{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="row" style={{ gap: 8, padding: "12px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)" }}>
                <window.I.Sparkle size={16} style={{ color: "var(--accent)" }}/>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                  Reminders will go out to <strong>Lorna</strong> and notify the calendar {form.leadDays} days before each due date.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button className="btn" onClick={back}><window.I.ChevronLeft size={14}/>Back</button>}
          <div className="spacer"></div>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step < 3 ? (
            <button className="btn btn-accent" onClick={next} disabled={step === 1 && !form.asset}>
              Continue <window.I.ChevronRight size={14}/>
            </button>
          ) : (
            <button className="btn btn-accent" onClick={() => onSave(form)}>
              <window.I.Check size={14}/>Create plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

window.AddMaintenanceModal = AddMaintenanceModal;

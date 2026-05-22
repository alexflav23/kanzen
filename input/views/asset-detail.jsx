// Asset detail — timeline-centric provenance view
function AssetDetail({ assetId, onBack }) {
  const a = window.INVENTORY.assetById[assetId];
  const [tab, setTab] = React.useState("timeline");
  const I = window.I;
  if (!a) return null;
  const Ico = I[a.photo?.icon] || I.Box;
  const prop = window.DATA.properties.find(p => p.id === a.location.propId);
  const cat = window.INVENTORY.categories.find(c => c.id === a.category);
  const timeline = window.INVENTORY.timelines[a.id] || [];
  const lifetimeCost = timeline.filter(e => e.cost).reduce((s, e) => s + e.cost, 0)
    + (a.acquisitionCost || 0);

  // collections containing this asset
  const inCollections = window.INVENTORY.collections.filter(c => c.members.includes(a.id));

  // Completeness reasons
  const missing = [];
  if (!a.docs || a.docs < 2) missing.push("Insurance certificate");
  if (a.completeness < 0.85) missing.push("Recent appraisal");
  if (!a.value?.insured) missing.push("Insured value not set");

  return (
    <div className="page fade-in" style={{ maxWidth: 1280, padding: "24px 32px 80px" }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 14 }}>
        <I.ChevronLeft size={14}/> Inventory
      </button>

      {/* Hero */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr" }}>
          <div style={{
            background: a.photo?.fill || "var(--bg-sunken)",
            display: "grid", placeItems: "center",
            position: "relative",
            minHeight: 320,
          }}>
            <Ico size={110} style={{ color: "rgba(255,255,255,.3)" }}/>
            <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {a.mode === "grouped-quantity" && (
                <span className="pill" style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: 0 }}>
                  Set of {a.tracking.quantity}{a.tracking.originalQty && a.tracking.originalQty !== a.tracking.quantity && <span style={{ opacity: 0.7 }}> · was {a.tracking.originalQty}</span>}
                </span>
              )}
              {a.mode === "structured-set" && (
                <span className="pill" style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: 0 }}>
                  <I.Layers size={11}/>{a.tracking.childCount} pieces
                </span>
              )}
            </div>
          </div>
          <div style={{ padding: "32px 36px" }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="pill pill-outline">{cat?.name}</span>
              <span className="pill"><span className="pill-dot" style={{ background: a.status === "Owned" ? "var(--positive)" : "var(--ink-4)" }}></span>{a.status}</span>
              {a.condition === "Service" && <span className="pill pill-warn"><I.Wrench size={11}/>At vendor</span>}
              <span className="spacer"></span>
              <button className="icon-btn"><I.Edit size={15}/></button>
              <button className="icon-btn"><I.External size={15}/></button>
            </div>
            <div className="t-small" style={{ marginBottom: 4 }}>{a.maker}</div>
            <div className="t-title" style={{ fontSize: 32, letterSpacing: "-0.022em", marginBottom: 18, lineHeight: 1.15 }}>{a.title}</div>

            {/* Key facts strip */}
            <div className="grid-4" style={{ gap: 14 }}>
              <KeyFact label="Current value" value={window.fmtMoneyShort(a.value?.current, a.currency)} sub={a.value?.source} />
              <KeyFact label="Insured value" value={window.fmtMoneyShort(a.value?.insured, a.currency)} sub={a.value?.insured ? "On schedule" : "Not insured"}/>
              <KeyFact label="Location" value={prop?.name || "—"} sub={a.location.sub || "—"} />
              <KeyFact label="Condition" value={a.condition} sub={a.timelineCount + " events"}/>
            </div>

            {/* Completeness bar */}
            <div style={{ marginTop: 22 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <I.Shield size={13} style={{ color: a.completeness > 0.85 ? "var(--positive)" : "var(--warn)" }}/>
                <span className="t-small">Completeness</span>
                <span className="spacer"></span>
                <span className="t-small" style={{ fontWeight: 600, color: "var(--ink)" }}>{Math.round(a.completeness * 100)}%</span>
              </div>
              <div className="bar"><i style={{ width: (a.completeness * 100) + "%", background: a.completeness > 0.85 ? "var(--positive)" : "var(--warn)" }}/></div>
              {missing.length > 0 && (
                <div className="t-small" style={{ marginTop: 6 }}>
                  Improve: {missing.join(" · ")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: "timeline", label: "Timeline", count: timeline.length },
          { id: "specs", label: "Specifications" },
          { id: "valuation", label: "Valuation" },
          { id: "provenance", label: "Provenance & insurance" },
          { id: "documents", label: "Documents", count: a.docs },
          { id: "comments", label: "Comments" },
        ].map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && <span className="pill" style={{ marginLeft: 6, height: 18, padding: "0 6px", fontSize: 10.5 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>
        <div>
          {tab === "timeline" && <TimelineTab timeline={timeline} asset={a}/>}
          {tab === "specs" && <SpecsTab asset={a}/>}
          {tab === "valuation" && <ValuationTab asset={a} timeline={timeline}/>}
          {tab === "provenance" && <ProvenanceTab asset={a}/>}
          {tab === "documents" && <DocumentsTab assetId={a.id}/>}
          {tab === "comments" && <CommentsTab/>}
        </div>

        {/* Sidekick */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>Lifetime cost</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.018em" }} className="num">
              {window.fmtMoneyShort(lifetimeCost, a.currency)}
            </div>
            <div className="t-small" style={{ marginTop: 4 }}>
              Acquisition + {timeline.filter(e => e.cost).length} service / cleaning events
            </div>
          </div>

          <div className="card card-pad">
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>In collections</div>
            {inCollections.length === 0 && <div className="t-small">Not in any collection</div>}
            <div className="col" style={{ gap: 8 }}>
              {inCollections.map(c => (
                <div key={c.id} className="row" style={{
                  padding: "8px 10px", background: "var(--bg-sunken)", borderRadius: 8, gap: 8,
                }}>
                  <I.Layers size={13} style={{ color: "var(--ink-3)" }}/>
                  <span style={{ fontSize: 12.5 }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(a.tags || []).map(t => <span key={t} className="pill">{t}</span>)}
              <button className="pill pill-outline" style={{ cursor: "pointer", background: "transparent" }}><I.Plus size={10}/>add</button>
            </div>
          </div>

          <div className="card card-pad">
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>Quick actions</div>
            <div className="col" style={{ gap: 6 }}>
              <button className="btn btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}><I.Plus size={13}/>Log an event</button>
              <button className="btn btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}><I.Move size={13}/>Move location</button>
              <button className="btn btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}><I.Trending size={13}/>Add valuation</button>
              <button className="btn btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}><I.Photo size={13}/>Upload photo</button>
              <button className="btn btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}><I.Layers size={13}/>Restructure</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyFact({ label, value, sub }) {
  return (
    <div>
      <div className="t-small" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", marginTop: 2 }} className="num">{value}</div>
      {sub && <div className="t-small" style={{ marginTop: 2, fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

function TimelineTab({ timeline, asset }) {
  return (
    <div className="card" style={{ padding: "8px 0" }}>
      {timeline.length === 0 ? (
        <div className="empty">No events recorded yet.</div>
      ) : (
        <div style={{ position: "relative", padding: "20px 28px" }}>
          {/* spine */}
          <div style={{
            position: "absolute", left: 39, top: 28, bottom: 28,
            width: 1, background: "var(--line)",
          }}/>
          <div className="col" style={{ gap: 22 }}>
            {timeline.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 14, position: "relative" }}>
                <div style={{ paddingTop: 6 }}>
                  <window.EventDot type={e.type}/>
                </div>
                <div>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</span>
                    <span className="spacer"></span>
                    <span className="t-small">{window.fmtDate(e.at)}</span>
                  </div>
                  {e.detail && <div className="muted t-small" style={{ marginBottom: 6 }}>{e.detail}</div>}
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    {e.party && <span className="pill"><window.I.Vendors size={10}/>{e.party}</span>}
                    {e.cost && <span className="pill pill-outline"><window.I.Pound size={10}/>{window.fmtMoneyShort(e.cost, e.currency || "GBP")}</span>}
                    {e.deltaValue && (
                      <span className="pill pill-positive">
                        <window.I.Trending size={10}/>+{window.fmtMoneyShort(e.deltaValue, asset.currency)} value
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpecsTab({ asset }) {
  const entries = Object.entries(asset.attrs || {});
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-header">
        <span className="card-title">{asset.vertical[0].toUpperCase() + asset.vertical.slice(1)} attributes</span>
        <span className="t-small">Typed template · {entries.length} fields</span>
      </div>
      <div style={{ padding: "20px 24px" }}>
        <dl className="meta-grid" style={{ gridTemplateColumns: "180px 1fr" }}>
          {entries.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt><dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

function ValuationTab({ asset, timeline }) {
  const valuations = timeline.filter(e => e.type === "valuation" || e.type === "appraisal");
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="grid-3">
          <KeyFact label="Acquisition cost" value={window.fmtMoneyShort(asset.acquisitionCost, asset.currency)} sub={typeof asset.acquired === "string" && asset.acquired.startsWith("Inherited") ? asset.acquired : window.fmtDate(asset.acquired)}/>
          <KeyFact label="Current market value" value={window.fmtMoneyShort(asset.value?.current, asset.currency)} sub={asset.value?.source}/>
          <KeyFact label="Insured value" value={window.fmtMoneyShort(asset.value?.insured, asset.currency)} sub={asset.value?.insured ? "Hiscox schedule" : "Not on schedule"}/>
        </div>
      </div>

      {asset.acquisitionCost && asset.value?.current && (
        <div className="card card-pad">
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Change since acquisition</div>
          <div className="row" style={{ gap: 12 }}>
            {(() => {
              const delta = asset.value.current - asset.acquisitionCost;
              const pct = Math.round((delta / asset.acquisitionCost) * 100);
              const up = delta >= 0;
              return (
                <>
                  <span style={{ fontSize: 28, fontWeight: 600, color: up ? "var(--positive)" : "var(--danger)" }} className="num">
                    {up ? "+" : ""}{window.fmtMoneyShort(delta, asset.currency)}
                  </span>
                  <span className="pill" style={{ background: up ? "var(--positive-soft)" : "var(--danger-soft)", color: up ? "var(--positive)" : "var(--danger)", border: 0 }}>
                    {up ? "+" : ""}{pct}%
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Valuation history</span>
          <button className="btn btn-sm"><window.I.Plus size={12}/>Add snapshot</button>
        </div>
        {valuations.length === 0 ? (
          <div className="empty">No valuation history yet.</div>
        ) : valuations.map((e, i) => (
          <div className="card-row" key={i}>
            <window.EventDot type={e.type}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.title}</div>
              <div className="muted t-small">{window.fmtDate(e.at)}{e.party && <><span className="dot-sep"></span>{e.party}</>}{e.detail && <><span className="dot-sep"></span>{e.detail}</>}</div>
            </div>
            {e.deltaValue && (
              <span className="pill pill-positive">+{window.fmtMoneyShort(e.deltaValue, asset.currency)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvenanceTab({ asset }) {
  return (
    <div className="grid-2">
      <div className="card card-pad-lg">
        <div className="t-eyebrow" style={{ marginBottom: 14 }}>Provenance</div>
        <dl className="meta-grid">
          <dt>Acquired</dt><dd>{typeof asset.acquired === "string" && asset.acquired.startsWith("Inherited") ? asset.acquired : window.fmtDate(asset.acquired)}</dd>
          <dt>Source</dt><dd>{(window.INVENTORY.timelines[asset.id] || []).find(e => e.type === "acquired")?.party || "—"}</dd>
          <dt>Acquisition cost</dt><dd className="num">{window.fmtMoneyShort(asset.acquisitionCost, asset.currency)}</dd>
          <dt>Provenance notes</dt><dd>{asset.attrs?.Provenance || "—"}</dd>
        </dl>
      </div>
      <div className="card card-pad-lg">
        <div className="t-eyebrow" style={{ marginBottom: 14 }}>Authenticity</div>
        <dl className="meta-grid">
          <dt>Serial / reference</dt><dd className="t-mono">{asset.attrs?.Serial || asset.attrs?.Reference || "—"}</dd>
          <dt>Box & papers</dt><dd>{asset.attrs?.["Box & papers"] || "—"}</dd>
          <dt>Signed</dt><dd>{asset.attrs?.Signed || "—"}</dd>
        </dl>
      </div>
      <div className="card card-pad-lg">
        <div className="t-eyebrow" style={{ marginBottom: 14 }}>Insurance</div>
        <dl className="meta-grid">
          <dt>Insured value</dt><dd className="num">{window.fmtMoneyShort(asset.value?.insured, asset.currency)}</dd>
          <dt>Policy</dt><dd>{asset.value?.insured ? "Hiscox · Contents 2026" : "Not on schedule"}</dd>
          <dt>Last appraisal</dt><dd>{(window.INVENTORY.timelines[asset.id] || []).find(e => e.type === "appraisal")?.at ? window.fmtDate((window.INVENTORY.timelines[asset.id] || []).find(e => e.type === "appraisal")?.at) : "—"}</dd>
        </dl>
      </div>
      <div className="card card-pad-lg">
        <div className="t-eyebrow" style={{ marginBottom: 14 }}>Warranty</div>
        <dl className="meta-grid">
          <dt>Manufacturer</dt><dd>{asset.maker}</dd>
          <dt>Coverage</dt><dd>—</dd>
          <dt>Expires</dt><dd>—</dd>
        </dl>
      </div>
    </div>
  );
}

function DocumentsTab({ assetId }) {
  const docs = window.INVENTORY.documents.filter(d => d.attachedTo?.type === "asset");
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Attached documents</span>
        <button className="btn btn-sm"><window.I.Plus size={12}/>Upload</button>
      </div>
      {docs.length === 0 ? <div className="empty">No documents yet.</div> : docs.slice(0, 4).map(d => (
        <div className="card-row clickable" key={d.id}>
          <window.I.Documents size={16}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</div>
            <div className="muted t-small">{d.category}<span className="dot-sep"></span>{d.size}<span className="dot-sep"></span>{window.fmtDate(d.uploaded)}{d.immutable && <><span className="dot-sep"></span>immutable original</>}</div>
          </div>
          {d.parseRuns > 0 && <span className="pill"><window.I.Sparkle size={10}/>{d.lineItems} line items</span>}
          <button className="icon-btn"><window.I.External size={13}/></button>
        </div>
      ))}
    </div>
  );
}

function CommentsTab() {
  return (
    <div className="card card-pad-lg">
      <div className="t-small">Free-form notes and discussion between Principal and Manager. Comments are part of the asset's audit trail.</div>
      <textarea className="input" rows={4} placeholder="Add a note about this asset…" style={{ marginTop: 12 }}></textarea>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="t-small">Visible to Principal · Manager</span>
        <span className="spacer"></span>
        <button className="btn btn-accent btn-sm">Post note</button>
      </div>
    </div>
  );
}

window.AssetDetail = AssetDetail;

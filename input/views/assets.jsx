// Asset Registry — the inventory module
function AssetsView({ onOpenAsset }) {
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState("grid"); // grid | list | timeline
  const [categoryFilter, setCategoryFilter] = React.useState(null);
  const [propertyFilter, setPropertyFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState(null);
  const [collectionFilter, setCollectionFilter] = React.useState(null);
  const [tagFilter, setTagFilter] = React.useState(null);
  const I = window.I;
  const INV = window.INVENTORY;

  const filtered = INV.assets.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.maker.toLowerCase().includes(q)) return false;
    }
    if (categoryFilter && a.category !== categoryFilter) {
      // also match parent category
      const cat = INV.categories.find(c => c.id === a.category);
      if (!cat || cat.parent !== categoryFilter) return false;
    }
    if (propertyFilter && a.location.propId !== propertyFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (collectionFilter && !(a.collections || []).includes(collectionFilter)) return false;
    if (tagFilter && !(a.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const totalValue = filtered.reduce((s, a) => s + (a.value?.current || 0), 0);
  const insuredValue = filtered.reduce((s, a) => s + (a.value?.insured || 0), 0);
  const allTags = Array.from(new Set(INV.assets.flatMap(a => a.tags || [])));

  function clearFilters() {
    setCategoryFilter(null);
    setPropertyFilter(null);
    setStatusFilter(null);
    setCollectionFilter(null);
    setTagFilter(null);
    setSearch("");
  }
  const activeFilterCount = [categoryFilter, propertyFilter, statusFilter, collectionFilter, tagFilter, search].filter(Boolean).length;

  return (
    <div className="page fade-in" style={{ maxWidth: 1400, padding: "32px 32px 80px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Registry · Principal-private</div>
          <div className="t-title">Inventory</div>
          <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
            Every owned object tracked through its life — provenance, valuation, location, custody, condition. Currently {INV.assetTotal} assets across all properties.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm">
            <I.Layers size={13}/>Bulk import
          </button>
          <button className="btn btn-accent">
            <I.Plus size={14}/>New asset
          </button>
        </div>
      </header>

      {/* Summary strip */}
      <div className="grid-4" style={{ marginTop: 24, marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="t-small">Assets shown</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">{filtered.length}</div>
          <div className="t-small" style={{ marginTop: 4 }}>of {INV.assetTotal} total</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Estimated value</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">
            {window.fmtMoneyShort(totalValue, "GBP")}
          </div>
          <div className="t-small" style={{ marginTop: 4 }}>Current market estimates</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Insured value</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">
            {window.fmtMoneyShort(insuredValue, "GBP")}
          </div>
          <div className="t-small" style={{ marginTop: 4 }}>Sum of policy schedules</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Completeness</div>
          <div className="row" style={{ marginTop: 4, gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.022em" }} className="num">{Math.round(INV.totalCompleteness * 100)}%</div>
            <I.Shield size={18} style={{ color: "var(--positive)" }}/>
          </div>
          <div className="t-small" style={{ marginTop: 4 }}>{INV.dataQuality.expensiveMissingProof} expensive missing proof</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "start" }}>
        {/* Filter rail */}
        <aside className="col" style={{ gap: 18, position: "sticky", top: 16 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="row" style={{ marginBottom: 10, padding: "0 4px" }}>
              <I.Filter size={13} style={{ color: "var(--ink-3)" }}/>
              <span className="t-eyebrow" style={{ fontSize: 10.5 }}>Filters</span>
              <span className="spacer"></span>
              {activeFilterCount > 0 && (
                <button className="btn-ghost btn btn-sm" onClick={clearFilters} style={{ height: 22, padding: "0 8px", fontSize: 11 }}>Clear</button>
              )}
            </div>

            {/* Category tree */}
            <FilterGroup label="Category" defaultOpen>
              {INV.categories.filter(c => !c.parent).map(c => (
                <React.Fragment key={c.id}>
                  <FilterRow active={categoryFilter === c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)} count={c.count}>
                    {c.name}
                  </FilterRow>
                  {INV.categories.filter(cc => cc.parent === c.id).map(child => (
                    <FilterRow key={child.id} active={categoryFilter === child.id} onClick={() => setCategoryFilter(categoryFilter === child.id ? null : child.id)} count={child.count} indent>
                      {child.name}
                    </FilterRow>
                  ))}
                </React.Fragment>
              ))}
            </FilterGroup>

            <FilterGroup label="Property">
              {window.DATA.properties.map(p => (
                <FilterRow key={p.id} active={propertyFilter === p.id} onClick={() => setPropertyFilter(propertyFilter === p.id ? null : p.id)}>
                  {p.name}
                </FilterRow>
              ))}
            </FilterGroup>

            <FilterGroup label="Status">
              {["Owned", "Sold", "Gifted", "Lost", "Stolen", "Archived"].map(s => (
                <FilterRow key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
                  {s}
                </FilterRow>
              ))}
            </FilterGroup>

            <FilterGroup label="Collection">
              {INV.collections.map(c => (
                <FilterRow key={c.id} active={collectionFilter === c.id} onClick={() => setCollectionFilter(collectionFilter === c.id ? null : c.id)} count={c.members.length}>
                  {c.name}
                </FilterRow>
              ))}
            </FilterGroup>

            <FilterGroup label="Tag">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 4px 0" }}>
                {allTags.map(t => (
                  <button key={t} className="pill"
                    style={{
                      cursor: "pointer",
                      background: tagFilter === t ? "var(--accent)" : "var(--bg-sunken)",
                      color: tagFilter === t ? "var(--accent-ink)" : "var(--ink-2)",
                      border: 0,
                    }}
                    onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                    {t}
                  </button>
                ))}
              </div>
            </FilterGroup>
          </div>

          {/* Data-quality nudge */}
          {INV.dataQuality.expensiveMissingProof > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <I.Alert size={14} style={{ color: "var(--warn)" }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Data quality</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                <li className="t-small">{INV.dataQuality.missingPhoto} missing photo</li>
                <li className="t-small">{INV.dataQuality.missingLocation} missing location</li>
                <li className="t-small">{INV.dataQuality.missingProof} missing proof</li>
                <li className="t-small" style={{ color: "var(--warn)" }}>{INV.dataQuality.expensiveMissingProof} expensive · no proof</li>
                <li className="t-small">{INV.dataQuality.suspectedDuplicates} suspected duplicate</li>
              </ul>
            </div>
          )}
        </aside>

        {/* Main */}
        <div className="col" style={{ gap: 18 }}>
          {/* Toolbar */}
          <div className="card" style={{ padding: "10px 14px" }}>
            <div className="row" style={{ gap: 12 }}>
              <I.Search size={15} style={{ color: "var(--ink-3)" }}/>
              <input
                className="input"
                style={{ border: 0, background: "transparent", padding: 0, fontSize: 14, height: 28 }}
                placeholder="Search inventory by name, maker, serial, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="segmented">
                <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
                <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
                <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>Timeline</button>
              </div>
              <button className="btn btn-sm"><I.Sliders size={13}/>Sort: Recent</button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {categoryFilter && <FilterChip onClear={() => setCategoryFilter(null)}>Category · {INV.categories.find(c => c.id === categoryFilter)?.name}</FilterChip>}
              {propertyFilter && <FilterChip onClear={() => setPropertyFilter(null)}>Property · {window.DATA.properties.find(p => p.id === propertyFilter)?.name}</FilterChip>}
              {statusFilter && <FilterChip onClear={() => setStatusFilter(null)}>Status · {statusFilter}</FilterChip>}
              {collectionFilter && <FilterChip onClear={() => setCollectionFilter(null)}>Collection · {INV.collections.find(c => c.id === collectionFilter)?.name}</FilterChip>}
              {tagFilter && <FilterChip onClear={() => setTagFilter(null)}>Tag · {tagFilter}</FilterChip>}
              {search && <FilterChip onClear={() => setSearch("")}>Search · "{search}"</FilterChip>}
            </div>
          )}

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="card empty" style={{ padding: 80 }}>
              <I.Search size={28}/>
              <div className="t-h2" style={{ marginTop: 12 }}>No matches</div>
              <div>Try clearing a filter or searching differently.</div>
            </div>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {filtered.map(a => <AssetCard key={a.id} asset={a} onOpen={() => onOpenAsset(a.id)}/>)}
            </div>
          ) : view === "list" ? (
            <AssetList assets={filtered} onOpen={onOpenAsset}/>
          ) : (
            <AssetTimeline assets={filtered} onOpen={onOpenAsset}/>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, defaultOpen, children }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "transparent", border: 0, padding: "8px 4px",
        width: "100%", display: "flex", alignItems: "center", gap: 6,
        cursor: "pointer", color: "var(--ink-3)",
      }}>
        <window.I.ChevronDown size={11} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s var(--ease-out)" }}/>
        <span className="t-eyebrow" style={{ fontSize: 10.5 }}>{label}</span>
      </button>
      {open && <div style={{ marginTop: 2, marginBottom: 6 }}>{children}</div>}
    </div>
  );
}
function FilterRow({ active, onClick, children, count, indent }) {
  return (
    <button onClick={onClick} style={{
      width: "100%",
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 8px 5px " + (indent ? "22px" : "8px"),
      borderRadius: 6,
      border: 0,
      background: active ? "var(--accent-soft)" : "transparent",
      color: active ? "var(--accent)" : "var(--ink-2)",
      cursor: "pointer",
      fontSize: 12.5,
      textAlign: "left",
    }}>
      <span style={{ flex: 1 }}>{children}</span>
      {count != null && <span className="t-small" style={{ color: active ? "var(--accent)" : "var(--ink-4)" }}>{count}</span>}
    </button>
  );
}
function FilterChip({ children, onClear }) {
  return (
    <span className="pill pill-accent" style={{ paddingRight: 4 }}>
      {children}
      <button className="icon-btn" onClick={onClear} style={{ width: 18, height: 18, color: "currentColor", marginLeft: 2 }}>
        <window.I.X size={11}/>
      </button>
    </span>
  );
}

function AssetCard({ asset, onOpen }) {
  const I = window.I;
  const Ico = I[asset.photo?.icon] || I.Box;
  const prop = window.DATA.properties.find(p => p.id === asset.location?.propId);
  return (
    <button onClick={onOpen} className="card" style={{
      padding: 0, textAlign: "left", cursor: "pointer", overflow: "hidden",
      transition: "transform .2s var(--ease-out), box-shadow .2s var(--ease-out)",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-1)"; }}>
      {/* photo placeholder */}
      <div style={{
        height: 150,
        background: asset.photo?.fill || "var(--bg-sunken)",
        display: "grid", placeItems: "center",
        position: "relative",
      }}>
        <Ico size={42} style={{ color: "rgba(255,255,255,.42)" }}/>
        {asset.condition === "Service" && (
          <span className="pill" style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(255,255,255,.18)",
            color: "#fff", border: 0,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}>
            <I.Wrench size={11}/>At service
          </span>
        )}
        {asset.mode === "grouped-quantity" && (
          <span className="pill" style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(255,255,255,.18)",
            color: "#fff", border: 0,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}>×{asset.tracking.quantity}</span>
        )}
        {asset.mode === "structured-set" && (
          <span className="pill" style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(255,255,255,.18)",
            color: "#fff", border: 0,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}><I.Layers size={11}/>set</span>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div className="t-small" style={{ fontSize: 11, marginBottom: 2 }}>{asset.maker}</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, letterSpacing: "-0.005em", lineHeight: 1.3, minHeight: 36 }}>
          {asset.title}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.008em" }} className="num">
            {window.fmtMoneyShort(asset.value?.current, asset.currency)}
          </span>
          <span className="spacer"></span>
          {(asset.tags || []).slice(0, 1).map(t => (
            <span key={t} className="pill" style={{ height: 18, fontSize: 10.5, padding: "0 7px" }}>{t}</span>
          ))}
        </div>
        <div className="t-small" style={{ marginTop: 6, fontSize: 11 }}>
          <I.Pin size={10} style={{ marginRight: 4, verticalAlign: "-1px" }}/>
          {prop?.name}{asset.location.sub && <> · {asset.location.sub}</>}
        </div>
      </div>
    </button>
  );
}

function AssetList({ assets, onOpen }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>Asset</th>
            <th>Category</th>
            <th>Location</th>
            <th>Condition</th>
            <th>Acquired</th>
            <th style={{textAlign:"right"}}>Value</th>
          </tr>
        </thead>
        <tbody>
          {assets.map(a => {
            const I = window.I;
            const Ico = I[a.photo?.icon] || I.Box;
            const prop = window.DATA.properties.find(p => p.id === a.location.propId);
            const cat = window.INVENTORY.categories.find(c => c.id === a.category);
            return (
              <tr key={a.id} onClick={() => onOpen(a.id)}>
                <td style={{ width: 56 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: a.photo?.fill || "var(--bg-sunken)",
                    display: "grid", placeItems: "center",
                  }}>
                    <Ico size={18} style={{ color: "rgba(255,255,255,.5)" }}/>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{a.title}</div>
                  <div className="muted t-small">{a.maker}</div>
                </td>
                <td>{cat?.name}</td>
                <td>
                  <div>{prop?.name}</div>
                  <div className="t-small">{a.location.sub}</div>
                </td>
                <td><span className="pill">{a.condition}</span></td>
                <td>{typeof a.acquired === "string" && a.acquired.startsWith("Inherited") ? a.acquired : window.fmtDate(a.acquired)}</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                  {window.fmtMoneyShort(a.value?.current, a.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssetTimeline({ assets, onOpen }) {
  // Synthesize: list all events from filtered assets, sort desc
  const events = [];
  assets.forEach(a => {
    (window.INVENTORY.timelines[a.id] || []).forEach(e => events.push({ ...e, asset: a }));
  });
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  const grouped = {};
  events.forEach(e => {
    const k = e.at.slice(0, 7); // YYYY-MM
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  });

  return (
    <div className="card" style={{ padding: 0 }}>
      {Object.entries(grouped).map(([month, evs]) => (
        <div key={month}>
          <div style={{
            padding: "12px 22px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}>
            <span className="t-eyebrow">{new Date(month + "-01").toLocaleDateString("en-GB", { year: "numeric", month: "long" })}</span>
          </div>
          {evs.map((e, i) => (
            <button
              key={e.asset.id + e.at + i}
              onClick={() => onOpen(e.asset.id)}
              className="card-row clickable"
              style={{ width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--line)", background: "transparent", padding: "14px 22px" }}>
              <span className="t-small" style={{ width: 70, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                {window.fmtDateShort(e.at)}
              </span>
              <EventDot type={e.type}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{e.title}</div>
                <div className="muted t-small">{e.asset.title}{e.party && <><span className="dot-sep"></span>{e.party}</>}</div>
              </div>
              {e.cost && <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>{window.fmtMoneyShort(e.cost, e.currency || "GBP")}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EventDot({ type }) {
  const map = {
    acquired: { bg: "var(--accent)", icon: "Plus" },
    valuation: { bg: "#15803D", icon: "Trending" },
    appraisal: { bg: "#15803D", icon: "Eye" },
    service: { bg: "#0EA5E9", icon: "Wrench" },
    "service-sent": { bg: "#0EA5E9", icon: "Move" },
    cleaning: { bg: "#0EA5E9", icon: "Sparkles" },
    moved: { bg: "#A855F7", icon: "Pin" },
    damage: { bg: "#B91C1C", icon: "Alert" },
    document: { bg: "var(--ink-3)", icon: "Documents" },
    custody: { bg: "#A855F7", icon: "Move" },
    wear: { bg: "var(--ink-3)", icon: "Heart" },
    setup: { bg: "#0EA5E9", icon: "Wrench" },
  };
  const m = map[type] || { bg: "var(--ink-4)", icon: "Box" };
  const Ico = window.I[m.icon];
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 999,
      background: m.bg + "1F", color: m.bg,
      display: "grid", placeItems: "center",
    }}>
      <Ico size={12}/>
    </div>
  );
}

window.AssetsView = AssetsView;
window.AssetCard = AssetCard;
window.EventDot = EventDot;

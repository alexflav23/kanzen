// Collections — arbitrary user-defined groupings
function CollectionsView({ onOpenCollection, onOpenAsset }) {
  const [open, setOpen] = React.useState(null);
  if (open) return <CollectionDetail collectionId={open} onBack={() => setOpen(null)} onOpenAsset={onOpenAsset}/>;
  return (
    <div className="page fade-in" style={{ padding: "32px 32px 80px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Inventory · groupings</div>
          <div className="t-title">Collections</div>
          <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
            Arbitrary groupings of assets — for browsing, reporting, insurance, estate planning. An asset can be in many collections.
          </div>
        </div>
        <button className="btn btn-accent"><window.I.Plus size={14}/>New collection</button>
      </header>

      <div className="grid-3">
        {window.INVENTORY.collections.map(c => (
          <CollectionCard key={c.id} collection={c} onOpen={() => setOpen(c.id)}/>
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ collection, onOpen }) {
  const I = window.I;
  const memberAssets = collection.members.map(id => window.INVENTORY.assetById[id]).filter(Boolean);
  const totalValue = memberAssets.reduce((s, a) => s + (a.value?.current || 0), 0);
  const previews = memberAssets.slice(0, 4);
  return (
    <button onClick={onOpen} className="card" style={{
      padding: 0,
      textAlign: "left",
      cursor: "pointer",
      transition: "transform .2s var(--ease-out), box-shadow .2s var(--ease-out)",
      overflow: "hidden",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-1)"; }}>
      {/* Cover collage */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 2,
        height: 180,
        background: "var(--bg-sunken)",
      }}>
        {previews.map((a, i) => {
          const Ico = I[a.photo?.icon] || I.Box;
          return (
            <div key={a.id} style={{
              background: a.photo?.fill || "var(--bg-sunken)",
              display: "grid", placeItems: "center",
            }}>
              <Ico size={22} style={{ color: "rgba(255,255,255,.45)" }}/>
            </div>
          );
        })}
        {previews.length < 4 && Array.from({ length: 4 - previews.length }).map((_, i) => (
          <div key={"e" + i} style={{ background: "var(--bg-sunken)" }}/>
        ))}
      </div>
      <div style={{ padding: "16px 18px 18px" }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.008em" }}>{collection.name}</span>
          <span className="spacer"></span>
          {collection.visibility === "Principal" && <I.Lock size={12} style={{ color: "var(--ink-4)" }}/>}
        </div>
        <div className="muted t-small" style={{ marginBottom: 12, minHeight: 32 }}>{collection.desc}</div>
        <div className="row">
          <span className="t-small">{collection.members.length} assets</span>
          {totalValue > 0 && (
            <>
              <span className="dot-sep"></span>
              <span className="t-small num" style={{ fontWeight: 500, color: "var(--ink-2)" }}>
                {window.fmtMoneyShort(totalValue, collection.currency || "GBP")}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function CollectionDetail({ collectionId, onBack, onOpenAsset }) {
  const c = window.INVENTORY.collections.find(x => x.id === collectionId);
  const assets = c.members.map(id => window.INVENTORY.assetById[id]).filter(Boolean);
  const total = assets.reduce((s, a) => s + (a.value?.current || 0), 0);
  return (
    <div className="page fade-in" style={{ padding: "24px 32px 80px" }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 14 }}>
        <window.I.ChevronLeft size={14}/>Collections
      </button>
      <header style={{ marginBottom: 28 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="pill pill-outline">Collection</span>
          {c.visibility === "Principal" && <span className="pill"><window.I.Lock size={11}/>Principal-private</span>}
        </div>
        <div className="t-title">{c.name}</div>
        <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>{c.desc}</div>
        <div className="row" style={{ marginTop: 18, gap: 28 }}>
          <div>
            <div className="t-small">Members</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.014em" }} className="num">{assets.length}</div>
          </div>
          <div>
            <div className="t-small">Total value</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.014em" }} className="num">{window.fmtMoneyShort(total, "GBP")}</div>
          </div>
        </div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {assets.map(a => (
          <window.AssetCard key={a.id} asset={a} onOpen={() => onOpenAsset(a.id)}/>
        ))}
      </div>
    </div>
  );
}

window.CollectionsView = CollectionsView;

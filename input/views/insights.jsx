// Insights — completeness, spend, lifetime cost
function InsightsView() {
  const I = window.I;
  const INV = window.INVENTORY;
  // Spend by category (synthesised from receipts + costs)
  const spendByCat = [
    { cat: "Watches", spent: 51_650, color: "#4F46E5" },
    { cat: "Art", spent: 92_000, color: "#A855F7" },
    { cat: "Guitars", spent: 13_200, color: "#F97316" },
    { cat: "Furniture", spent: 7_400, color: "#0EA5E9" },
    { cat: "Clothing", spent: 11_720, color: "#15803D" },
    { cat: "Porcelain", spent: 22_000, color: "#B45309" },
    { cat: "Glassware", spent: 720, color: "#475569" },
  ];
  const totalSpend = spendByCat.reduce((s, c) => s + c.spent, 0);

  // Top assets by value
  const topAssets = [...INV.assets].sort((a, b) => (b.value?.current || 0) - (a.value?.current || 0)).slice(0, 6);

  // Lifetime cost per top asset
  const lifetime = topAssets.map(a => {
    const t = INV.timelines[a.id] || [];
    const ops = t.filter(e => e.cost).reduce((s, e) => s + e.cost, 0);
    return { asset: a, acquisition: a.acquisitionCost || 0, ops };
  });

  return (
    <div className="page fade-in" style={{ maxWidth: 1280, padding: "32px 32px 80px" }}>
      <header style={{ marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Aggregate reporting · Principal-private</div>
        <div className="t-title">Insights</div>
        <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
          Where the money went, what the household owns, what it's worth, and what's missing.
        </div>
      </header>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="t-small">Total inventory value</div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">{window.fmtMoneyShort(window.INVENTORY.totalValue, "GBP")}</div>
          <div className="t-small" style={{ marginTop: 4, color: "var(--positive)" }}>+12% YoY</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Lifetime spend</div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">{window.fmtMoneyShort(totalSpend, "GBP")}</div>
          <div className="t-small" style={{ marginTop: 4 }}>Acquisition + maintenance</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Assets tracked</div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em", marginTop: 4 }} className="num">{window.INVENTORY.assetTotal}</div>
          <div className="t-small" style={{ marginTop: 4 }}>Across 8 categories</div>
        </div>
        <div className="card card-pad">
          <div className="t-small">Completeness</div>
          <div className="row" style={{ marginTop: 4 }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.022em" }} className="num">{Math.round(window.INVENTORY.totalCompleteness * 100)}%</div>
          </div>
          <div className="bar" style={{ marginTop: 8 }}><i style={{ width: (window.INVENTORY.totalCompleteness * 100) + "%", background: "var(--positive)" }}/></div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
        {/* Lifetime spend by category */}
        <div className="card card-pad-lg">
          <div className="t-eyebrow" style={{ marginBottom: 16 }}>Lifetime spend · by category</div>
          {/* Stacked bar */}
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 22 }}>
            {spendByCat.map(c => (
              <div key={c.cat} style={{ width: (c.spent / totalSpend * 100) + "%", background: c.color, transition: "width .6s var(--ease-out)" }}/>
            ))}
          </div>
          <div className="col" style={{ gap: 12 }}>
            {spendByCat.map(c => (
              <div key={c.cat} className="row">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }}/>
                <span style={{ fontSize: 13 }}>{c.cat}</span>
                <span className="spacer"></span>
                <span className="t-small" style={{ width: 50 }}>{Math.round(c.spent / totalSpend * 100)}%</span>
                <span className="num" style={{ fontSize: 13, fontWeight: 500, minWidth: 90, textAlign: "right" }}>{window.fmtMoneyShort(c.spent, "GBP")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top assets by value */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top assets · by current value</span>
          </div>
          {topAssets.map(a => (
            <div className="card-row" key={a.id}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: a.photo?.fill || "var(--bg-sunken)",
                display: "grid", placeItems: "center",
              }}>
                {(() => { const Ico = I[a.photo?.icon] || I.Box; return <Ico size={16} style={{ color: "rgba(255,255,255,.6)" }}/>; })()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{a.title}</div>
                <div className="muted t-small">{a.maker}<span className="dot-sep"></span>insured {window.fmtMoneyShort(a.value?.insured, a.currency)}</div>
              </div>
              <div className="num" style={{ fontWeight: 500 }}>{window.fmtMoneyShort(a.value?.current, a.currency)}</div>
            </div>
          ))}
        </div>

        {/* Lifetime cost vs acquisition */}
        <div className="card card-pad-lg">
          <div className="t-eyebrow" style={{ marginBottom: 16 }}>Lifetime cost · acquisition vs operating</div>
          <div className="col" style={{ gap: 16 }}>
            {lifetime.map(l => {
              const total = l.acquisition + l.ops;
              return (
                <div key={l.asset.id}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{l.asset.title}</span>
                    <span className="spacer"></span>
                    <span className="num t-small" style={{ fontWeight: 500, color: "var(--ink)" }}>{window.fmtMoneyShort(total, l.asset.currency)}</span>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--bg-sunken)" }}>
                    <div style={{ width: (l.acquisition / total * 100) + "%", background: "var(--accent)" }}/>
                    <div style={{ width: (l.ops / total * 100) + "%", background: "#0EA5E9" }}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ gap: 18, marginTop: 16 }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ width: 10, height: 10, background: "var(--accent)", borderRadius: 2 }}></span>
              <span className="t-small">Acquisition</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ width: 10, height: 10, background: "#0EA5E9", borderRadius: 2 }}></span>
              <span className="t-small">Operating cost</span>
            </div>
          </div>
        </div>

        {/* Completeness breakdown */}
        <div className="card card-pad-lg">
          <div className="t-eyebrow" style={{ marginBottom: 16 }}>Registry health</div>
          <div className="col" style={{ gap: 14 }}>
            {[
              { label: "Photographed", pct: 0.94 },
              { label: "Categorised", pct: 1.0 },
              { label: "Located + sub-location", pct: 0.97 },
              { label: "Proof attached", pct: 0.92 },
              { label: "Insured value set", pct: 0.65 },
              { label: "Last appraisal under 24mo", pct: 0.42 },
            ].map(r => (
              <div key={r.label}>
                <div className="row" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{r.label}</span>
                  <span className="spacer"></span>
                  <span className="t-small" style={{ fontWeight: 600, color: "var(--ink)" }}>{Math.round(r.pct * 100)}%</span>
                </div>
                <div className="bar"><i style={{ width: (r.pct * 100) + "%", background: r.pct > 0.85 ? "var(--positive)" : r.pct > 0.6 ? "var(--accent)" : "var(--warn)" }}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.InsightsView = InsightsView;

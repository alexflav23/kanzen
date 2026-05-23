import * as stylex from "@stylexjs/stylex";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { AssetCard } from "../components/AssetCard";
import { Pill } from "../components/Pill";
import { Card } from "../components/Card";
import { Plus, Layers, Search, Filter, ChevronDown, X, Shield, Alert, Pin } from "../components/icons";
import {
  ASSETS, CATEGORIES, STATUSES, ALL_TAGS, ASSET_TOTAL, TOTAL_COMPLETENESS, DATA_QUALITY,
  fmtMoneyShort, categoryName, propName, type MockAsset,
} from "../data/mockInventory";
import { PROPERTIES } from "../data/mockProperties";

const styles = stylex.create({
  page: { maxWidth: "1400px" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", maxWidth: "620px", fontSize: "14px" },
  hbtns: { display: "flex", gap: "8px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  btnAccent: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", margin: "24px 0" },
  stat: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "16px 18px" },
  statL: { fontSize: "12px", color: colors.ink3 },
  statN: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.022em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  statSub: { fontSize: "12px", color: colors.ink3, marginTop: "4px" },
  statRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" },
  layout: { display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px", alignItems: "start" },
  rail: { display: "flex", flexDirection: "column", gap: "18px", position: "sticky", top: "16px" },
  railCard: { padding: "14px" },
  railHead: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "0 4px", color: colors.ink3 },
  railTitle: { fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 },
  grow: { flex: 1 },
  clear: { border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "11px" },
  group: { marginBottom: "8px" },
  groupBtn: { background: "transparent", border: 0, padding: "8px 4px", width: "100%", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: colors.ink3 },
  frow: { width: "100%", display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", borderRadius: radius.sm, border: 0, background: "transparent", color: colors.ink2, cursor: "pointer", fontSize: "12.5px", textAlign: "left" },
  frowActive: { backgroundColor: colors.accentSoft, color: colors.accent },
  frowIndent: { paddingLeft: "22px" },
  frowCount: { fontSize: "11px", color: colors.ink3 },
  tagWrap: { display: "flex", flexWrap: "wrap", gap: "4px", padding: "4px 4px 0" },
  tag: { padding: "2px 9px", borderRadius: radius.sm, fontSize: "12px", border: 0, cursor: "pointer", backgroundColor: colors.bgSunken, color: colors.ink2 },
  tagActive: { backgroundColor: colors.accent, color: colors.accentInk },
  dq: { padding: "16px" },
  dqHead: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontSize: "12.5px", fontWeight: 600 },
  dqList: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: colors.ink3 },
  main: { display: "flex", flexDirection: "column", gap: "18px" },
  toolbar: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev },
  input: { border: 0, background: "transparent", padding: 0, fontSize: "14px", height: "28px", flex: 1, color: colors.ink, outline: "none" },
  seg: { display: "inline-flex", border: `1px solid ${colors.line}`, borderRadius: radius.sm, overflow: "hidden" },
  segBtn: { padding: "5px 12px", border: 0, background: "transparent", cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
  segActive: { backgroundColor: colors.accent, color: colors.accentInk },
  chips: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" },
  chipClear: { display: "inline-flex", alignItems: "center", gap: "6px" },
  chipX: { border: 0, background: "transparent", color: "inherit", cursor: "pointer", display: "inline-flex", padding: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" },
  empty: { padding: "80px", textAlign: "center", color: colors.ink3 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px", cursor: "pointer" },
  tdR: { textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" },
  swatch: { width: "40px", height: "40px", borderRadius: "8px" },
  num: { fontVariantNumeric: "tabular-nums" },
});

function FilterGroup({ label, defaultOpen, children }: { label: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div {...stylex.props(styles.group)}>
      <button type="button" onClick={() => setOpen(!open)} {...stylex.props(styles.groupBtn)}>
        <span style={{ display: "inline-flex", transform: open ? "none" : "rotate(-90deg)" }}><ChevronDown size={11} /></span>
        <span {...stylex.props(styles.railTitle)}>{label}</span>
      </button>
      {open && <div style={{ marginTop: 2, marginBottom: 6 }}>{children}</div>}
    </div>
  );
}

function FilterRow({ active, onClick, children, count, indent }: { active: boolean; onClick: () => void; children: ReactNode; count?: number; indent?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} {...stylex.props(styles.frow, active && styles.frowActive, indent && styles.frowIndent)}>
      <span {...stylex.props(styles.grow)}>{children}</span>
      {count != null && <span {...stylex.props(styles.frowCount)}>{count}</span>}
    </button>
  );
}

export function Inventory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string | null>(null);
  const [property, setProperty] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const filtered = ASSETS.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.maker.toLowerCase().includes(q)) return false;
    }
    if (category && a.category !== category) {
      const cat = CATEGORIES.find((c) => c.id === a.category);
      if (!cat || cat.parent !== category) return false;
    }
    if (property && a.propId !== property) return false;
    if (status && a.status !== status) return false;
    if (tag && !a.tags.includes(tag)) return false;
    return true;
  });

  const totalValue = filtered.reduce((s, a) => s + a.current, 0);
  const insuredValue = filtered.reduce((s, a) => s + a.insured, 0);
  const active = [category, property, status, tag, search].filter(Boolean).length;
  const clearAll = () => { setCategory(null); setProperty(null); setStatus(null); setTag(null); setSearch(""); };

  const open = (a: MockAsset) => navigate(`/inventory/${a.id}`);

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Registry · Principal-private</div>
          <h1 {...stylex.props(styles.title)}>Inventory</h1>
          <div {...stylex.props(styles.desc)}>
            Every owned object tracked through its life — provenance, valuation, location, custody, condition. Currently {ASSET_TOTAL} assets across all properties.
          </div>
        </div>
        <div {...stylex.props(styles.hbtns)}>
          <button type="button" {...stylex.props(styles.btn)}><Layers size={13} /> Bulk import</button>
          <button type="button" {...stylex.props(styles.btn, styles.btnAccent)}><Plus size={14} /> New asset</button>
        </div>
      </header>

      <div {...stylex.props(styles.stats)}>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Assets shown</div>
          <div {...stylex.props(styles.statN)}>{filtered.length}</div>
          <div {...stylex.props(styles.statSub)}>of {ASSET_TOTAL} total</div>
        </div>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Estimated value</div>
          <div {...stylex.props(styles.statN)}>{fmtMoneyShort(totalValue, "GBP")}</div>
          <div {...stylex.props(styles.statSub)}>Current market estimates</div>
        </div>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Insured value</div>
          <div {...stylex.props(styles.statN)}>{fmtMoneyShort(insuredValue, "GBP")}</div>
          <div {...stylex.props(styles.statSub)}>Sum of policy schedules</div>
        </div>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Completeness</div>
          <div {...stylex.props(styles.statRow)}>
            <div {...stylex.props(styles.statN)} style={{ marginTop: 0 }}>{Math.round(TOTAL_COMPLETENESS * 100)}%</div>
            <span style={{ color: colors.positive, display: "inline-flex" }}><Shield size={18} /></span>
          </div>
          <div {...stylex.props(styles.statSub)}>{DATA_QUALITY.expensiveMissingProof} expensive missing proof</div>
        </div>
      </div>

      <div {...stylex.props(styles.layout)}>
        {/* Filter rail */}
        <aside {...stylex.props(styles.rail)}>
          <Card style={styles.railCard}>
            <div {...stylex.props(styles.railHead)}>
              <Filter size={13} />
              <span {...stylex.props(styles.railTitle)}>Filters</span>
              <span {...stylex.props(styles.grow)} />
              {active > 0 && <button type="button" onClick={clearAll} {...stylex.props(styles.clear)}>Clear</button>}
            </div>

            <FilterGroup label="Category" defaultOpen>
              {CATEGORIES.filter((c) => !c.parent).map((c) => (
                <div key={c.id}>
                  <FilterRow active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)} count={c.count}>{c.name}</FilterRow>
                  {CATEGORIES.filter((cc) => cc.parent === c.id).map((child) => (
                    <FilterRow key={child.id} indent active={category === child.id} onClick={() => setCategory(category === child.id ? null : child.id)} count={child.count}>{child.name}</FilterRow>
                  ))}
                </div>
              ))}
            </FilterGroup>

            <FilterGroup label="Property">
              {PROPERTIES.map((p) => (
                <FilterRow key={p.id} active={property === p.id} onClick={() => setProperty(property === p.id ? null : p.id)}>{p.name}</FilterRow>
              ))}
            </FilterGroup>

            <FilterGroup label="Status">
              {STATUSES.map((s) => (
                <FilterRow key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>{s}</FilterRow>
              ))}
            </FilterGroup>

            <FilterGroup label="Tag">
              <div {...stylex.props(styles.tagWrap)}>
                {ALL_TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} {...stylex.props(styles.tag, tag === t && styles.tagActive)}>{t}</button>
                ))}
              </div>
            </FilterGroup>
          </Card>

          <Card style={styles.dq}>
            <div {...stylex.props(styles.dqHead)}>
              <span style={{ color: colors.warn, display: "inline-flex" }}><Alert size={14} /></span> Data quality
            </div>
            <ul {...stylex.props(styles.dqList)}>
              <li>{DATA_QUALITY.missingPhoto} missing photo</li>
              <li>{DATA_QUALITY.missingLocation} missing location</li>
              <li>{DATA_QUALITY.missingProof} missing proof</li>
              <li style={{ color: colors.warn }}>{DATA_QUALITY.expensiveMissingProof} expensive · no proof</li>
              <li>{DATA_QUALITY.suspectedDuplicates} suspected duplicate</li>
            </ul>
          </Card>
        </aside>

        {/* Main */}
        <div {...stylex.props(styles.main)}>
          <div {...stylex.props(styles.toolbar)}>
            <Search size={15} />
            <input
              {...stylex.props(styles.input)}
              placeholder="Search inventory by name, maker, serial, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search inventory"
            />
            <div {...stylex.props(styles.seg)} role="tablist" aria-label="View">
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} {...stylex.props(styles.segBtn, view === "grid" && styles.segActive)}>Grid</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} {...stylex.props(styles.segBtn, view === "list" && styles.segActive)}>List</button>
            </div>
          </div>

          {active > 0 && (
            <div {...stylex.props(styles.chips)}>
              {category && <FilterChip onClear={() => setCategory(null)}>Category · {categoryName(category)}</FilterChip>}
              {property && <FilterChip onClear={() => setProperty(null)}>Property · {propName(property)}</FilterChip>}
              {status && <FilterChip onClear={() => setStatus(null)}>Status · {status}</FilterChip>}
              {tag && <FilterChip onClear={() => setTag(null)}>Tag · {tag}</FilterChip>}
              {search && <FilterChip onClear={() => setSearch("")}>Search · "{search}"</FilterChip>}
            </div>
          )}

          {filtered.length === 0 ? (
            <Card>
              <div {...stylex.props(styles.empty)}>
                <Search size={28} />
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12, color: colors.ink }}>No matches</div>
                <div>Try clearing a filter or searching differently.</div>
              </div>
            </Card>
          ) : view === "grid" ? (
            <div {...stylex.props(styles.grid)} data-testid="asset-grid">
              {filtered.map((a) => <AssetCard key={a.id} asset={a} onOpen={() => open(a)} />)}
            </div>
          ) : (
            <Card>
              <table {...stylex.props(styles.table)}>
                <thead>
                  <tr>
                    <th {...stylex.props(styles.th)} />
                    <th {...stylex.props(styles.th)}>Asset</th>
                    <th {...stylex.props(styles.th)}>Category</th>
                    <th {...stylex.props(styles.th)}>Location</th>
                    <th {...stylex.props(styles.th)}>Condition</th>
                    <th {...stylex.props(styles.th, styles.thR)}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} data-testid="asset-row" onClick={() => open(a)}>
                      <td {...stylex.props(styles.td)} style={{ width: 56 }}>
                        <div {...stylex.props(styles.swatch)} style={{ background: a.fill }} />
                      </td>
                      <td {...stylex.props(styles.td)}>
                        <div style={{ fontWeight: 500 }}>{a.title}</div>
                        <div {...stylex.props(styles.statL)}>{a.maker}</div>
                      </td>
                      <td {...stylex.props(styles.td)}>{categoryName(a.category)}</td>
                      <td {...stylex.props(styles.td)}>
                        <div>{propName(a.propId)}</div>
                        <div {...stylex.props(styles.statL)}><Pin size={10} /> {a.sub}</div>
                      </td>
                      <td {...stylex.props(styles.td)}><Pill>{a.condition}</Pill></td>
                      <td {...stylex.props(styles.td, styles.tdR)}>{fmtMoneyShort(a.current, a.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <Pill tone="accent">
      <span {...stylex.props(styles.chipClear)}>
        {children}
        <button type="button" onClick={onClear} {...stylex.props(styles.chipX)} aria-label="Clear filter"><X size={11} /></button>
      </span>
    </Pill>
  );
}

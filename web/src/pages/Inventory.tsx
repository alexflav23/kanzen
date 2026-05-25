import * as stylex from "@stylexjs/stylex";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "../components/Pill";
import { Card } from "../components/Card";
import { Plus, Search, Filter, ChevronDown, X, Shield } from "../components/icons";
import { createAsset, listAssets, type AssetView } from "../services/assets";
import { listCategories, type Category } from "../services/categories";
import { getRegistryHealth } from "../services/insights";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const STATUS_OPTIONS = ["owned", "sold", "gifted", "lost", "stolen", "archived"];
const MODES = ["unique", "grouped_quantity", "structured_set"];

const styles = stylex.create({
  page: { maxWidth: "1400px" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", maxWidth: "620px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent, cursor: "pointer", fontSize: "13px" },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", margin: "24px 0" },
  stat: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "16px 18px" },
  statL: { fontSize: "12px", color: colors.ink3 },
  statN: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.022em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  statSub: { fontSize: "12px", color: colors.ink3, marginTop: "4px" },
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
  acard: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "16px", textAlign: "left", cursor: "pointer", color: colors.ink, display: "flex", flexDirection: "column", gap: "8px" },
  amaker: { fontSize: "11.5px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3 },
  atitle: { fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" },
  arow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px", cursor: "pointer" },
  bold: { fontWeight: 500 },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  chev: { display: "inline-flex" },
  chevClosed: { transform: "rotate(-90deg)" },
  dqList: { listStyle: "none", margin: 0, padding: "0 4px", display: "flex", flexDirection: "column", gap: "7px" },
  dqRow: { display: "flex", alignItems: "center", fontSize: "12.5px", color: colors.ink2 },
  dqPct: { fontVariantNumeric: "tabular-nums", color: colors.ink3, fontWeight: 500 },
  dqLink: { display: "inline-block", marginTop: "12px", padding: "0 4px", fontSize: "12px", color: colors.accent, textDecoration: "none" },
});

function FilterGroup({ label, defaultOpen, children }: { label: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div {...stylex.props(styles.group)}>
      <button type="button" onClick={() => setOpen(!open)} {...stylex.props(styles.groupBtn)}>
        <span {...stylex.props(styles.chev, !open && styles.chevClosed)}><ChevronDown size={11} /></span>
        <span {...stylex.props(styles.railTitle)}>{label}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function FilterRow({ active, onClick, children, indent }: { active: boolean; onClick: () => void; children: ReactNode; indent?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} {...stylex.props(styles.frow, active && styles.frowActive, indent && styles.frowIndent)}>
      <span {...stylex.props(styles.grow)}>{children}</span>
    </button>
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

function NewAssetModal({ token, categories, onClose }: { token: string | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [maker, setMaker] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [trackingMode, setMode] = useState("unique");
  const [quantity, setQuantity] = useState(1);
  const mutation = useMutation({
    mutationFn: () =>
      createAsset({ title, maker: maker || null, categoryId, vertical: null, trackingMode, quantity,
        parentAssetId: null, acquisitionCostMinor: null, acquisitionCurrency: null, locationId: null, attributes: null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-asset" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (title.trim() && categoryId) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New asset</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
          <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Royal Oak 15500ST" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Maker</span>
          <input {...stylex.props(styles.control)} aria-label="Maker" value={maker} onChange={(e) => setMaker(e.target.value)} placeholder="e.g. Audemars Piguet" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Category</span>
          <select {...stylex.props(styles.control)} aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Tracking mode</span>
          <select {...stylex.props(styles.control)} aria-label="Tracking mode" value={trackingMode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Quantity</span>
          <input {...stylex.props(styles.control)} aria-label="Quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !title.trim()}>
            {mutation.isPending ? "Adding…" : "Add asset"}
          </button>
        </div>
      </form>
    </div>
  );
}

function modeBadge(a: AssetView): string | null {
  if (a.trackingMode === "grouped_quantity") return `×${a.quantity}`;
  if (a.trackingMode === "structured_set") return "set";
  return null;
}

export function Inventory() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const assetsQ = useQuery({ queryKey: ["assets", category, search, token], queryFn: () => listAssets(token, category, search) });
  const catsQ = useQuery({ queryKey: ["categories", token], queryFn: () => listCategories(token) });
  // F23 registry health — available to anyone who can read the registry (this page's gate).
  const healthQ = useQuery({ queryKey: ["registry-health", token], queryFn: () => getRegistryHealth(token) });
  const h = healthQ.data;
  const completeness = h ? Math.round((h.photographedPct + h.categorisedPct + h.locatedPct + h.proofPct) / 4) : null;

  const categories = catsQ.data ?? [];
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [categories]);

  const all = assetsQ.data ?? [];
  const shown = status ? all.filter((a) => a.ownershipStatus === status) : all;
  const active = [category, status, search].filter(Boolean).length;
  const clearAll = () => { setCategory(null); setStatus(null); setSearch(""); };
  const topCats = categories.filter((c) => !c.parentId);

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Registry · Principal-private</div>
          <h1 {...stylex.props(styles.title)}>Inventory</h1>
          <div {...stylex.props(styles.desc)}>Every owned object tracked through its life — provenance, valuation, location, custody, condition.</div>
        </div>
        <button type="button" onClick={() => setAdding(true)} {...stylex.props(styles.btn)}><Plus size={14} /> New asset</button>
      </header>

      {adding && <NewAssetModal token={token} categories={categories} onClose={() => setAdding(false)} />}

      <div {...stylex.props(styles.stats)}>
        <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statL)}>Assets shown</div><div {...stylex.props(styles.statN)}>{shown.length}</div><div {...stylex.props(styles.statSub)}>of {all.length} in registry</div></div>
        <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statL)}>Categories</div><div {...stylex.props(styles.statN)}>{categories.length}</div><div {...stylex.props(styles.statSub)}>across the registry</div></div>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Completeness</div>
          <div {...stylex.props(styles.statN)}>{completeness != null ? `${completeness}%` : "—"}</div>
          <div {...stylex.props(styles.statSub)}>across {h?.total ?? all.length} assets</div>
        </div>
        <div {...stylex.props(styles.stat)}>
          <div {...stylex.props(styles.statL)}>Proof of value</div>
          <div {...stylex.props(styles.statN)}>{h ? `${h.proofPct}%` : "—"}</div>
          <div {...stylex.props(styles.statSub)}>have documented proof</div>
        </div>
      </div>

      <div {...stylex.props(styles.layout)}>
        <aside {...stylex.props(styles.rail)}>
          <Card style={styles.railCard}>
            <div {...stylex.props(styles.railHead)}>
              <Filter size={13} /><span {...stylex.props(styles.railTitle)}>Filters</span>
              <span {...stylex.props(styles.grow)} />
              {active > 0 && <button type="button" onClick={clearAll} {...stylex.props(styles.clear)}>Clear</button>}
            </div>
            <FilterGroup label="Category" defaultOpen>
              {topCats.map((c) => (
                <div key={c.id}>
                  <FilterRow active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>{c.name}</FilterRow>
                  {categories.filter((cc) => cc.parentId === c.id).map((child) => (
                    <FilterRow key={child.id} indent active={category === child.id} onClick={() => setCategory(category === child.id ? null : child.id)}>{child.name}</FilterRow>
                  ))}
                </div>
              ))}
            </FilterGroup>
            <FilterGroup label="Status">
              {STATUS_OPTIONS.map((s) => (
                <FilterRow key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>{s}</FilterRow>
              ))}
            </FilterGroup>
          </Card>

          {h && (
            <Card style={styles.railCard}>
              <div {...stylex.props(styles.railHead)}>
                <Shield size={13} /><span {...stylex.props(styles.railTitle)}>Data quality</span>
              </div>
              <ul {...stylex.props(styles.dqList)}>
                <li {...stylex.props(styles.dqRow)}><span {...stylex.props(styles.grow)}>Photographed</span><span {...stylex.props(styles.dqPct)}>{h.photographedPct}%</span></li>
                <li {...stylex.props(styles.dqRow)}><span {...stylex.props(styles.grow)}>Categorised</span><span {...stylex.props(styles.dqPct)}>{h.categorisedPct}%</span></li>
                <li {...stylex.props(styles.dqRow)}><span {...stylex.props(styles.grow)}>Located</span><span {...stylex.props(styles.dqPct)}>{h.locatedPct}%</span></li>
                <li {...stylex.props(styles.dqRow)}><span {...stylex.props(styles.grow)}>Proof of value</span><span {...stylex.props(styles.dqPct)}>{h.proofPct}%</span></li>
              </ul>
              <Link to="/insights" {...stylex.props(styles.dqLink)}>View registry health →</Link>
            </Card>
          )}
        </aside>

        <div {...stylex.props(styles.main)}>
          <div {...stylex.props(styles.toolbar)}>
            <Search size={15} />
            <input {...stylex.props(styles.input)} placeholder="Search inventory by name or maker…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search inventory" />
            <div {...stylex.props(styles.seg)} aria-label="View">
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} {...stylex.props(styles.segBtn, view === "grid" && styles.segActive)}>Grid</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} {...stylex.props(styles.segBtn, view === "list" && styles.segActive)}>List</button>
            </div>
          </div>

          {active > 0 && (
            <div {...stylex.props(styles.chips)}>
              {category && <FilterChip onClear={() => setCategory(null)}>Category · {categoryName(category)}</FilterChip>}
              {status && <FilterChip onClear={() => setStatus(null)}>Status · {status}</FilterChip>}
              {search && <FilterChip onClear={() => setSearch("")}>Search · "{search}"</FilterChip>}
            </div>
          )}

          {assetsQ.isPending ? <Loading label="Loading the registry…" />
            : assetsQ.isError ? <ErrorState error={assetsQ.error} />
            : shown.length === 0 ? <EmptyState title="No assets">Nothing matches — try clearing a filter, or add an asset.</EmptyState>
            : view === "grid" ? (
              <div {...stylex.props(styles.grid)} data-testid="asset-grid">
                {shown.map((a) => (
                  <button key={a.id} type="button" data-testid="asset-card" onClick={() => navigate(`/inventory/${a.id}`)} {...stylex.props(styles.acard)}>
                    {a.maker && <div {...stylex.props(styles.amaker)}>{a.maker}</div>}
                    <div {...stylex.props(styles.atitle)}>{a.title}</div>
                    <div {...stylex.props(styles.arow)}>
                      <Pill>{categoryName(a.categoryId)}</Pill>
                      {modeBadge(a) && <Pill tone="accent">{modeBadge(a)}</Pill>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Card>
                <table {...stylex.props(styles.table)}>
                  <thead><tr>
                    <th {...stylex.props(styles.th)}>Asset</th><th {...stylex.props(styles.th)}>Category</th>
                    <th {...stylex.props(styles.th)}>Mode</th><th {...stylex.props(styles.th)}>Status</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id} data-testid="asset-row" onClick={() => navigate(`/inventory/${a.id}`)}>
                        <td {...stylex.props(styles.td)}><div {...stylex.props(styles.bold)}>{a.title}</div><div {...stylex.props(styles.statL)}>{a.maker}</div></td>
                        <td {...stylex.props(styles.td)}>{categoryName(a.categoryId)}</td>
                        <td {...stylex.props(styles.td)}>{a.trackingMode.replace("_", " ")}{modeBadge(a) ? ` · ${modeBadge(a)}` : ""}</td>
                        <td {...stylex.props(styles.td)}><Pill>{a.ownershipStatus}</Pill></td>
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

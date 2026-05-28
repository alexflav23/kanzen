import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill, type PillTone } from "../components/Pill";
import { Card } from "../components/Card";
import { Plus, Search, Filter, ChevronDown, X, Shield } from "../components/icons";
import { createAsset, getTemplate, listAssets, type AssetView } from "../services/assets";
import { listCategories, type Category } from "../services/categories";
import { getRegistryHealth } from "../services/insights";
import { listProperties } from "../services/properties";
import { listLocations } from "../services/locations";
import { listCollections, addMember } from "../services/collections";
import { listTags } from "../services/tags";
import { searchBrands, recordBrand } from "../services/brands";
import { fmtMoney } from "../data/money";
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
  acard: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "12px", textAlign: "left", cursor: "pointer", color: colors.ink, display: "flex", flexDirection: "column", gap: "8px" },
  aphoto: { width: "100%", aspectRatio: "4 / 3", borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.bgSunken, display: "block" },
  aphotoImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  aphotoEmpty: { width: "100%", height: "100%", display: "grid", placeItems: "center", color: colors.ink4, fontSize: "22px", fontWeight: 600 },
  abody: { display: "flex", flexDirection: "column", gap: "6px", padding: "0 4px 2px" },
  amaker: { fontSize: "11.5px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3 },
  atitle: { fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" },
  arow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" },
  afoot: { display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" },
  avalue: { fontSize: "14px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: colors.ink },
  aloc: { fontSize: "11.5px", color: colors.ink3, marginLeft: "auto" },
  // F24/Vehicles — bespoke vehicle card
  vcard: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "16px", textAlign: "left", cursor: "pointer", color: colors.ink, display: "flex", flexDirection: "column", gap: "6px" },
  vsub: { fontSize: "12.5px", color: colors.ink3 },
  vplate: { alignSelf: "flex-start", marginTop: "6px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontSize: "15px", letterSpacing: "0.12em", color: colors.ink, backgroundColor: colors.bgSunken, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: "4px 10px" },
  vmeta: { display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${colors.line}` },
  vmetaRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" },
  vmetaK: { fontSize: "12px", color: colors.ink3 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px", cursor: "pointer" },
  bold: { fontWeight: 500 },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "460px", maxHeight: "88vh", overflowY: "auto", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  specHead: { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, margin: "18px 0 10px", paddingTop: "14px", borderTop: `1px solid ${colors.line}` },
  field: { display: "block", marginBottom: "12px" },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  sectionLabel: { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, margin: "18px 0 8px" },
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

function NewAssetModal({ token, categories, vertical, onClose }: { token: string | null; categories: Category[]; vertical?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const brandListId = useId();
  // When launched from a vertical (e.g. Vehicles), default the category to that vertical's category
  // (the vertical is roughly the singular of the category name: vehicle→Vehicles, watch→Watches).
  const presetCatId = vertical
    ? categories.find((c) => { const n = c.name.toLowerCase(); const v = vertical.toLowerCase(); return n === v || n === `${v}s`; })?.id
    : undefined;
  const [title, setTitle] = useState("");
  const [maker, setMaker] = useState("");
  const [categoryId, setCategoryId] = useState(presetCatId ?? categories[0]?.id ?? "");
  // Categories may still be loading when the modal opens — apply the preset once they arrive.
  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(presetCatId ?? categories[0].id);
  }, [categories, categoryId, presetCatId]);
  const [trackingMode, setMode] = useState("unique");
  const [quantity, setQuantity] = useState(2);
  // Location (property → its location tree)
  const [propertyId, setPropertyId] = useState("");
  const [locationId, setLocationId] = useState("");
  // Acquisition
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [acqDate, setAcqDate] = useState("");
  // Collection
  const [collectionId, setCollectionId] = useState("");
  // F22 — typed specifications from the vertical's template (when launched within a vertical)
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const templateQ = useQuery({ queryKey: ["template", vertical, token], queryFn: () => getTemplate(vertical!, token), enabled: !!vertical });
  const specFields = templateQ.data ?? [];

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name ?? "";
  // Debounce the maker text so the catalogue search doesn't fire on every keystroke.
  const [debouncedMaker, setDebouncedMaker] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMaker(maker), 180);
    return () => clearTimeout(t);
  }, [maker]);

  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const locsQ = useQuery({ queryKey: ["locations", propertyId, token], queryFn: () => listLocations(propertyId, token), enabled: !!propertyId });
  const collsQ = useQuery({ queryKey: ["collections", token], queryFn: () => listCollections(token) });
  // Maker autocomplete from the global brand catalogue, keyed to the selected category.
  const brandsQ = useQuery({
    queryKey: ["brands", selectedCategoryName, debouncedMaker, token],
    queryFn: () => searchBrands(selectedCategoryName, debouncedMaker, token),
    enabled: !!selectedCategoryName,
  });
  const brandExample = (debouncedMaker.trim() === "" ? brandsQ.data?.[0]?.name : undefined) ?? undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      const asset = await createAsset({
        title: title.trim(), maker: maker.trim() || null, categoryId, vertical: vertical ?? null,
        trackingMode, quantity: trackingMode === "grouped_quantity" ? Math.max(1, quantity) : 1,
        parentAssetId: null,
        acquisitionCostMinor: cost.trim() ? Math.round(parseFloat(cost) * 100) : null,
        acquisitionCurrency: cost.trim() ? currency : null,
        acquisitionDate: acqDate || null,
        locationId: locationId || null,
        attributes: specFields.length
          ? Object.fromEntries(
              specFields.flatMap((f) => {
                const v = (attrs[f.key] ?? "").trim();
                return v ? [[f.key, f.fieldType === "number" ? Number(v) : v]] : [];
              }),
            )
          : null,
      }, token);
      if (collectionId) await addMember(token, collectionId, asset.id);
      // grow the global brand catalogue + this account's hot cache from real usage (non-fatal)
      if (maker.trim() && selectedCategoryName) {
        try { await recordBrand(maker.trim(), selectedCategoryName, token); } catch { /* enrichment is best-effort */ }
      }
      return asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      if (collectionId) qc.invalidateQueries({ queryKey: ["collections"] });
      onClose();
    },
  });

  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-asset" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (title.trim() && categoryId) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New {vertical ?? "asset"}</div>

        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
          <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Royal Oak 15500ST" autoFocus /></label>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Maker</span>
            <input
              {...stylex.props(styles.control)}
              aria-label="Maker"
              list={brandListId}
              autoComplete="off"
              value={maker}
              onChange={(e) => setMaker(e.target.value)}
              placeholder={brandExample ? `e.g. ${brandExample}` : "e.g. maker / brand"}
            />
            <datalist id={brandListId}>
              {(brandsQ.data ?? []).map((b) => <option key={b.id} value={b.name} />)}
            </datalist></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Category</span>
            <select {...stylex.props(styles.control)} aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>

        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Tracking</span>
            <select {...stylex.props(styles.control)} aria-label="Tracking mode" value={trackingMode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select></label>
          {trackingMode === "grouped_quantity" && (
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Quantity</span>
              <input {...stylex.props(styles.control)} aria-label="Quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></label>
          )}
        </div>

        <div {...stylex.props(styles.sectionLabel)}>Location</div>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Property</span>
            <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setLocationId(""); }}>
              <option value="">—</option>
              {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Room / location</span>
            <select {...stylex.props(styles.control)} aria-label="Location" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!propertyId}>
              <option value="">—</option>
              {(locsQ.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></label>
        </div>

        <div {...stylex.props(styles.sectionLabel)}>Acquisition</div>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Cost</span>
            <input {...stylex.props(styles.control)} aria-label="Acquisition cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 18500" /></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Currency</span>
            <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["GBP", "SGD", "USD", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
        </div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Acquired on</span>
          <input {...stylex.props(styles.control)} aria-label="Acquired on" type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} /></label>

        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Collection (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            <option value="">—</option>
            {(collsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>

        {specFields.length > 0 && (
          <>
            <div {...stylex.props(styles.specHead)} data-testid="spec-fields">Specifications</div>
            {specFields.map((f) => (
              <label key={f.key} {...stylex.props(styles.field)}>
                <span {...stylex.props(styles.label)}>{specLabel(f.key)}{f.required ? " *" : ""}</span>
                <input
                  {...stylex.props(styles.control)}
                  aria-label={specLabel(f.key)}
                  type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                  value={attrs[f.key] ?? ""}
                  onChange={(e) => setAttrs({ ...attrs, [f.key]: e.target.value })}
                />
              </label>
            ))}
          </>
        )}

        {mutation.isError && <div {...stylex.props(styles.label)} role="alert">Couldn't create the asset.</div>}
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

/** Due-date status for a vehicle's MOT/Tax/Insurance → a coloured pill (overdue=danger, ≤30d=warn, else neutral). */
function vDue(raw: unknown): { tone: PillTone; text: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  const text = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  if (days < 0) return { tone: "danger", text: `${text} · overdue` };
  if (days <= 30) return { tone: "warn", text: `${text} · soon` };
  return { tone: "default", text };
}

/** F24/Vehicles — a bespoke vehicle card (maker · model/colour · reg plate + MOT/Tax/Insurance due pills). */
function VehicleCard({ a, onOpen }: { a: AssetView; onOpen: () => void }) {
  const at = (a.attributes ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof at[k] === "string" ? (at[k] as string) : null);
  const reg = str("registration");
  const sub = [str("colour"), str("model")].filter(Boolean).join(" · ");
  const meta: [string, ReturnType<typeof vDue>][] = [["MOT", vDue(at.mot_due)], ["Tax", vDue(at.tax_due)], ["Insurance", vDue(at.insurance_due)]];
  return (
    <button type="button" data-testid="vehicle-card" onClick={onOpen} {...stylex.props(styles.vcard)}>
      <div {...stylex.props(styles.amaker)}>{a.maker ?? "Vehicle"}</div>
      <div {...stylex.props(styles.atitle)}>{a.title}</div>
      {sub && <div {...stylex.props(styles.vsub)}>{sub}</div>}
      {reg && <span {...stylex.props(styles.vplate)} data-testid="reg-plate">{reg}</span>}
      {meta.some(([, d]) => d) && (
        <div {...stylex.props(styles.vmeta)}>
          {meta.filter((m): m is [string, NonNullable<ReturnType<typeof vDue>>] => m[1] !== null).map(([label, d]) => (
            <div key={label} {...stylex.props(styles.vmetaRow)}>
              <span {...stylex.props(styles.vmetaK)}>{label}</span>
              <Pill tone={d.tone}>{d.text}</Pill>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

/** Humanise a template field key for its label (e.g. case_mm → "Case mm", vin → "Vin"). */
function specLabel(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function modeBadge(a: AssetView): string | null {
  if (a.trackingMode === "grouped_quantity") return `×${a.quantity}`;
  if (a.trackingMode === "structured_set") return "set";
  return null;
}

/** The generic registry surface. A `vertical` narrows it to one kind (e.g. Vehicles = the `vehicle`
  * vertical) — same cards, add-flow, detail and stats; nothing bespoke per asset type. */
export function Inventory({ vertical, label }: { vertical?: string; label?: string } = {}) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [property, setProperty] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const assetsQ = useQuery({
    queryKey: ["assets", { category, q: search, vertical: vertical ?? null, property, collection, status, tag }, token],
    queryFn: () => listAssets(token, { category, q: search, vertical, property, collection, status, tag }),
  });
  const catsQ = useQuery({ queryKey: ["categories", token], queryFn: () => listCategories(token) });
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const collsQ = useQuery({ queryKey: ["collections", token], queryFn: () => listCollections(token) });
  const tagsQ = useQuery({ queryKey: ["tags", token], queryFn: () => listTags(token) });
  // F23 registry health — available to anyone who can read the registry (this page's gate).
  const healthQ = useQuery({ queryKey: ["registry-health", token], queryFn: () => getRegistryHealth(token) });
  const h = healthQ.data;
  const completeness = h ? Math.round((h.photographedPct + h.categorisedPct + h.locatedPct + h.proofPct) / 4) : null;

  const categories = catsQ.data ?? [];
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [categories]);
  const propName = (id: string | null) => propsQ.data?.find((p) => p.id === id)?.name ?? "—";
  const collName = (id: string | null) => collsQ.data?.find((c) => c.id === id)?.name ?? "—";
  const tagName = (id: string | null) => tagsQ.data?.find((t) => t.id === id)?.name ?? "—";

  const all = assetsQ.data ?? [];
  const shown = all; // the server applies every facet (category/status/property/collection/q/vertical)
  // Acquisition-cost rollup, per currency (no silent FX — F37 display conversion lands later).
  const valueByCcy = all.reduce<Record<string, number>>((m, a) => {
    if (a.acquisitionCostMinor != null) { const c = a.acquisitionCurrency ?? "GBP"; m[c] = (m[c] ?? 0) + a.acquisitionCostMinor; }
    return m;
  }, {});
  const valueLabel = Object.entries(valueByCcy).map(([c, v]) => fmtMoney(v, c)).join(" · ") || "—";
  const active = [category, status, search, property, collection, tag].filter(Boolean).length;
  const clearAll = () => { setCategory(null); setStatus(null); setSearch(""); setProperty(null); setCollection(null); setTag(null); };
  const topCats = categories.filter((c) => !c.parentId);

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Registry · Principal-private</div>
          <h1 {...stylex.props(styles.title)}>{label ?? "Inventory"}</h1>
          <div {...stylex.props(styles.desc)}>Every owned object tracked through its life — provenance, valuation, location, custody, condition.</div>
        </div>
        <button type="button" onClick={() => setAdding(true)} {...stylex.props(styles.btn)}><Plus size={14} /> New {label ? label.replace(/s$/, "").toLowerCase() : "asset"}</button>
      </header>

      {adding && <NewAssetModal token={token} categories={categories} vertical={vertical} onClose={() => setAdding(false)} />}

      <div {...stylex.props(styles.stats)}>
        <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statL)}>Assets shown</div><div {...stylex.props(styles.statN)}>{shown.length}</div><div {...stylex.props(styles.statSub)}>of {h?.total ?? all.length} in registry</div></div>
        <div {...stylex.props(styles.stat)}><div {...stylex.props(styles.statL)}>Acquisition value</div><div {...stylex.props(styles.statN)} data-testid="value-total">{valueLabel}</div><div {...stylex.props(styles.statSub)}>cost basis · market est. with F20</div></div>
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
            <FilterGroup label="Property">
              {(propsQ.data ?? []).map((p) => (
                <FilterRow key={p.id} active={property === p.id} onClick={() => setProperty(property === p.id ? null : p.id)}>{p.name}</FilterRow>
              ))}
            </FilterGroup>
            <FilterGroup label="Status">
              {STATUS_OPTIONS.map((s) => (
                <FilterRow key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>{s}</FilterRow>
              ))}
            </FilterGroup>
            <FilterGroup label="Collection">
              {(collsQ.data ?? []).map((c) => (
                <FilterRow key={c.id} active={collection === c.id} onClick={() => setCollection(collection === c.id ? null : c.id)}>{c.name}</FilterRow>
              ))}
            </FilterGroup>
            {(tagsQ.data ?? []).length > 0 && (
              <FilterGroup label="Tag">
                {(tagsQ.data ?? []).map((t) => (
                  <FilterRow key={t.id} active={tag === t.id} onClick={() => setTag(tag === t.id ? null : t.id)}>{t.name}</FilterRow>
                ))}
              </FilterGroup>
            )}
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
              {property && <FilterChip onClear={() => setProperty(null)}>Property · {propName(property)}</FilterChip>}
              {collection && <FilterChip onClear={() => setCollection(null)}>Collection · {collName(collection)}</FilterChip>}
              {tag && <FilterChip onClear={() => setTag(null)}>Tag · {tagName(tag)}</FilterChip>}
              {status && <FilterChip onClear={() => setStatus(null)}>Status · {status}</FilterChip>}
              {search && <FilterChip onClear={() => setSearch("")}>Search · "{search}"</FilterChip>}
            </div>
          )}

          {assetsQ.isPending ? <Loading label="Loading the registry…" />
            : assetsQ.isError ? <ErrorState error={assetsQ.error} />
            : shown.length === 0 ? <EmptyState title="No assets">Nothing matches — try clearing a filter, or add an asset.</EmptyState>
            : view === "grid" ? (
              <div {...stylex.props(styles.grid)} data-testid="asset-grid">
                {vertical === "vehicle"
                  ? shown.map((a) => <VehicleCard key={a.id} a={a} onOpen={() => navigate(`/inventory/${a.id}`)} />)
                  : shown.map((a) => (
                  <button key={a.id} type="button" data-testid="asset-card" onClick={() => navigate(`/inventory/${a.id}`)} {...stylex.props(styles.acard)}>
                    <span {...stylex.props(styles.aphoto)} data-testid="asset-photo-cell">
                      {a.heroUrl
                        ? <img {...stylex.props(styles.aphotoImg)} src={a.heroUrl} alt="" loading="lazy" data-testid="asset-photo" />
                        : <span {...stylex.props(styles.aphotoEmpty)} aria-hidden="true">{a.title.charAt(0).toUpperCase()}</span>}
                    </span>
                    <div {...stylex.props(styles.abody)}>
                      {a.maker && <div {...stylex.props(styles.amaker)}>{a.maker}</div>}
                      <div {...stylex.props(styles.atitle)}>{a.title}</div>
                      <div {...stylex.props(styles.arow)}>
                        <Pill>{categoryName(a.categoryId)}</Pill>
                        {modeBadge(a) && <Pill tone="accent">{modeBadge(a)}</Pill>}
                      </div>
                      <div {...stylex.props(styles.afoot)}>
                        <span {...stylex.props(styles.avalue)}>{a.acquisitionCostMinor != null ? fmtMoney(a.acquisitionCostMinor, a.acquisitionCurrency ?? "GBP") : "—"}</span>
                        {a.propertyId && <span {...stylex.props(styles.aloc)}>{propName(a.propertyId)}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Card>
                <table {...stylex.props(styles.table)}>
                  <thead><tr>
                    <th {...stylex.props(styles.th)}>Asset</th><th {...stylex.props(styles.th)}>Category</th>
                    <th {...stylex.props(styles.th)}>Location</th><th {...stylex.props(styles.th)}>Status</th>
                    <th {...stylex.props(styles.th)}>Value</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id} data-testid="asset-row" onClick={() => navigate(`/inventory/${a.id}`)}>
                        <td {...stylex.props(styles.td)}><div {...stylex.props(styles.bold)}>{a.title}</div><div {...stylex.props(styles.statL)}>{a.maker}</div></td>
                        <td {...stylex.props(styles.td)}>{categoryName(a.categoryId)}</td>
                        <td {...stylex.props(styles.td)}>{a.propertyId ? propName(a.propertyId) : "—"}</td>
                        <td {...stylex.props(styles.td)}><Pill>{a.ownershipStatus}</Pill></td>
                        <td {...stylex.props(styles.td, styles.bold)}>{a.acquisitionCostMinor != null ? fmtMoney(a.acquisitionCostMinor, a.acquisitionCurrency ?? "GBP") : "—"}</td>
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

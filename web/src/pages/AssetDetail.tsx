import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { MediaGallery } from "../components/MediaGallery";
import { TagChips } from "../components/TagChips";
import { AssetGroups } from "../components/AssetGroups";
import { Timeline } from "../components/Timeline";
import { Bar } from "../components/Bar";
import { ActivityFeed } from "../features/audit/ActivityFeed";
import { ProvenanceParties } from "../components/ProvenanceParties";
import {
  changeCustody, editAsset, getAsset, getAssetHistory, getAssetTimeline, getInsurance, getValuations, listAssets,
  listWarranties, logAssetEvent, moveAsset, recordValuation, setHeroPhoto, CUSTODY_STATUSES,
  type AssetDetail as AssetDetailT,
} from "../services/assets";
import { mergeAssets, splitAsset, reverseRestructure } from "../services/restructure";
import { listCategories } from "../services/categories";
import { collectionsForAsset } from "../services/collections";
import { documentsFor } from "../services/documents";
import { listProperties } from "../services/properties";
import { listLocations } from "../services/locations";
import { Move } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  page: { maxWidth: "1100px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  tabBar: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, margin: "18px 0 22px", flexWrap: "wrap" },
  tab: { appearance: "none", border: 0, background: "transparent", color: colors.ink3, padding: "10px 14px", borderBottom: "2px solid transparent", marginBottom: "-1px", fontSize: "13.5px", cursor: "pointer" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "6px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  pills: { display: "flex", gap: "6px", marginTop: "10px", marginBottom: "14px" },
  tagsRow: { marginBottom: "24px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  kv: { display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  kvK: { color: colors.ink3, textTransform: "capitalize" },
  kvV: { fontWeight: 500, textTransform: "capitalize" },
  note: { padding: "14px 20px", fontSize: "12.5px", color: colors.ink3 },
  section: { marginTop: "24px" },
  cardPad: { padding: "16px 20px" },
  heroWrap: { width: "100%", height: "240px", borderRadius: radius.lg, overflow: "hidden", marginBottom: "20px", backgroundColor: colors.bgSunken, border: `1px solid ${colors.line}` },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  kvActions: { display: "flex", gap: "8px", padding: "12px 20px", borderBottom: `1px solid ${colors.line}` },
  kvBtn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  histRow: { display: "flex", gap: "12px", padding: "12px 20px", borderBottom: `1px solid ${colors.line}` },
  histGrow: { flex: 1, minWidth: 0 },
  histTitle: { fontSize: "13.5px", fontWeight: 500, color: colors.ink },
  histSub: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  histWhen: { fontSize: "12px", color: colors.ink3, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1 },
  evTitle: { fontSize: "13.5px", fontWeight: 500, textTransform: "capitalize" },
  evSub: { fontSize: "12px", color: colors.ink3 },
  evCost: { fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  valBar: { marginTop: "7px", maxWidth: "240px" },
  lifetime: { display: "flex", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${colors.line}`, fontSize: "13.5px", fontWeight: 600 },
  action: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12.5px" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  subhead: { fontSize: "13px", fontWeight: 600, color: colors.ink, margin: "14px 0 8px", paddingTop: "12px", borderTop: `1px solid ${colors.line}` },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

function money(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "GBP" }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

// Mirrors the backend's allowed lifecycle event types (api.AssetEvents.TYPES).
const EVENT_TYPES = ["serviced", "repaired", "cleaned", "moved", "appraised", "inspected", "restored", "lent", "returned", "note"];

const humanCustody = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function LogEventModal({ id, token, onClose }: { id: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState("serviced");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [party, setParty] = useState("");
  const [date, setDate] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      logAssetEvent(id, token, {
        eventType,
        costMinor: cost.trim() ? Math.round(parseFloat(cost) * 100) : null,
        currency: cost.trim() ? "GBP" : null,
        note: note.trim() || null,
        party: party.trim() || null,
        occurredAt: date || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-timeline", id] });
      qc.invalidateQueries({ queryKey: ["activity", "asset", id] });
      onClose();
    },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="log-event" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Log event</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Type</span>
          <select {...stylex.props(styles.control)} aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Date (optional — backdate to record retroactively)</span>
          <input {...stylex.props(styles.control)} aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Cost (£, optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 450" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Party (vendor/person, optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Party" value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. AP Service Centre" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Note</span>
          <input {...stylex.props(styles.control)} aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual service at AP" autoFocus /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending}>{mutation.isPending ? "Logging…" : "Log event"}</button>
        </div>
      </form>
    </div>
  );
}

function RecordValuationModal({ id, token, onClose }: { id: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState("market");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const mutation = useMutation({
    mutationFn: () => recordValuation(id, token, { kind, amountMinor: Math.round(parseFloat(amount || "0") * 100), currency: "GBP", source: source.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-valuations", id] });
      qc.invalidateQueries({ queryKey: ["asset", id] }); // Key facts shows the latest valuation
      onClose();
    },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="record-valuation" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (amount.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Record valuation</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Kind</span>
          <select {...stylex.props(styles.control)} aria-label="Valuation kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["market", "insured", "appraisal"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Amount (£)</span>
          <input {...stylex.props(styles.control)} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 38000" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Source (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. AP boutique appraisal" /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !amount.trim()}>{mutation.isPending ? "Saving…" : "Record"}</button>
        </div>
      </form>
    </div>
  );
}

const ASSET_STATUSES = ["owned", "sold", "gifted", "lost", "stolen", "archived"];

function EditAssetModal(
  { asset, categories, token, onClose }: { asset: AssetDetailT; categories: { id: string; name: string }[]; token: string | null; onClose: () => void },
) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(asset.title);
  const [maker, setMaker] = useState(asset.maker ?? "");
  const [categoryId, setCategoryId] = useState(asset.categoryId ?? categories[0]?.id ?? "");
  const [ownershipStatus, setStatus] = useState(asset.ownershipStatus);
  const mutation = useMutation({
    mutationFn: () => editAsset(asset.id, token, { title: title.trim(), maker: maker.trim() || null, categoryId, ownershipStatus }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["asset", asset.id] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="edit-asset" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (title.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Edit asset</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
          <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Maker</span>
          <input {...stylex.props(styles.control)} aria-label="Maker" value={maker} onChange={(e) => setMaker(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Category</span>
          <select {...stylex.props(styles.control)} aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Status</span>
          <select {...stylex.props(styles.control)} aria-label="Status" value={ownershipStatus} onChange={(e) => setStatus(e.target.value)}>
            {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !title.trim()}>{mutation.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function MoveModal({ asset, token, onClose }: { asset: AssetDetailT; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [propertyId, setPropertyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");
  const locsQ = useQuery({ queryKey: ["locations", propertyId, token], queryFn: () => listLocations(propertyId, token), enabled: !!propertyId });
  const mutation = useMutation({
    mutationFn: () => moveAsset(asset.id, token, { locationId: locationId || null, note: note.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["asset-history", asset.id] });
      qc.invalidateQueries({ queryKey: ["activity", "asset", asset.id] }); // refresh the Activity feed
      onClose();
    },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="move-asset" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            onSubmit={(e) => { e.preventDefault(); if (locationId) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Move asset</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Property</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setLocationId(""); }}>
            <option value="" disabled>Select a property…</option>
            {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Location</span>
          <select {...stylex.props(styles.control)} aria-label="Location" value={locationId} disabled={!propertyId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="" disabled>{propertyId ? "Select a location…" : "Pick a property first"}</option>
            {(locsQ.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Note (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. moved to the safe" /></label>
        {mutation.isError && <div {...stylex.props(styles.note)}>Couldn’t move — the location may be out of your scope.</div>}
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !locationId}>{mutation.isPending ? "Moving…" : "Move"}</button>
        </div>
      </form>
    </div>
  );
}

function CustodyModal({ asset, token, onClose }: { asset: AssetDetailT; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(asset.custodyStatus);
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => changeCustody(asset.id, token, { custodyStatus: status, note: note.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["asset-history", asset.id] });
      qc.invalidateQueries({ queryKey: ["activity", "asset", asset.id] }); // refresh the Activity feed
      onClose();
    },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="change-custody" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Change custody</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Custody</span>
          <select {...stylex.props(styles.control)} aria-label="Custody" value={status} onChange={(e) => setStatus(e.target.value)}>
            {CUSTODY_STATUSES.map((s) => <option key={s} value={s}>{humanCustody(s)}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Note (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sent to AP for service" autoFocus /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function RestructureModal({ asset, token, onClose, navigate }: { asset: AssetDetailT; token: string | null; onClose: () => void; navigate: (to: string) => void }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(2);
  const [survivorId, setSurvivorId] = useState("");
  const [result, setResult] = useState<{ opId: string; text: string; survivor?: string } | null>(null);
  const others = useQuery({ queryKey: ["assets-all", token], queryFn: () => listAssets(token, {}) });
  const inv = () => { qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["asset", asset.id] }); };
  const splitMut = useMutation({ mutationFn: () => splitAsset(token, asset.id, count), onSuccess: (r) => { setResult({ opId: r.opId, text: `Split into ${r.childIds.length} new asset(s); acquisition cost allocated across them.` }); inv(); } });
  const mergeMut = useMutation({ mutationFn: () => mergeAssets(token, survivorId, asset.id), onSuccess: (r) => { setResult({ opId: r.opId, text: "Merged into the survivor — this asset was absorbed (lineage + cost preserved).", survivor: r.survivorId }); inv(); } });
  const undoMut = useMutation({ mutationFn: (opId: string) => reverseRestructure(token, opId), onSuccess: () => { setResult(null); inv(); } });
  const targets = (others.data ?? []).filter((x) => x.id !== asset.id);

  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <div {...stylex.props(styles.modal)} data-testid="restructure" onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.modalTitle)}>Restructure</div>
        {result ? (
          <div>
            <div {...stylex.props(styles.note)} data-testid="restructure-result">{result.text}</div>
            <div {...stylex.props(styles.actions)}>
              {result.survivor && <button type="button" {...stylex.props(styles.ghost)} onClick={() => navigate(`/inventory/${result.survivor}`)}>Open survivor</button>}
              <button type="button" {...stylex.props(styles.ghost)} disabled={undoMut.isPending} onClick={() => undoMut.mutate(result.opId)}>Undo</button>
              <button type="button" {...stylex.props(styles.primary)} onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div {...stylex.props(styles.subhead)}>Split</div>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Split into N assets (cost allocated)</span>
              <input {...stylex.props(styles.control)} aria-label="Split count" type="number" min={2} value={count} onChange={(e) => setCount(Math.max(2, Number(e.target.value)))} /></label>
            <div {...stylex.props(styles.actions)}>
              <button type="button" {...stylex.props(styles.primary)} data-testid="split-go" disabled={splitMut.isPending} onClick={() => splitMut.mutate()}>Split</button>
            </div>

            <div {...stylex.props(styles.subhead)}>Merge</div>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Merge this asset into another (this one is absorbed)</span>
              <select {...stylex.props(styles.control)} aria-label="Survivor" value={survivorId} onChange={(e) => setSurvivorId(e.target.value)}>
                <option value="">Choose the survivor…</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select></label>
            <div {...stylex.props(styles.actions)}>
              <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
              <button type="button" {...stylex.props(styles.primary)} data-testid="merge-go" disabled={!survivorId || mergeMut.isPending} onClick={() => mergeMut.mutate()}>Merge</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssetDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token, can } = useAuth();
  const [logging, setLogging] = useState(false);
  const [valuing, setValuing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [changingCustody, setChangingCustody] = useState(false);
  const [restructuring, setRestructuring] = useState(false);
  const [tab, setTab] = useState<"overview" | "timeline" | "provenance" | "value">("overview");
  const qc = useQueryClient();
  const assetQ = useQuery({ queryKey: ["asset", id, token], queryFn: () => getAsset(id, token) });
  const catsQ = useQuery({ queryKey: ["categories", token], queryFn: () => listCategories(token), enabled: assetQ.isSuccess });
  const timelineQ = useQuery({ queryKey: ["asset-timeline", id, token], queryFn: () => getAssetTimeline(id, token), enabled: assetQ.isSuccess });
  const warrantiesQ = useQuery({ queryKey: ["asset-warranties", id, token], queryFn: () => listWarranties(id, token), enabled: assetQ.isSuccess });
  const collectionsQ = useQuery({ queryKey: ["asset-collections", id, token], queryFn: () => collectionsForAsset(token, id), enabled: assetQ.isSuccess });
  // Valuation history + insurance are Principal-only; a Manager session 403s — render only on success.
  const valuationsQ = useQuery({ queryKey: ["asset-valuations", id, token], queryFn: () => getValuations(id, token), enabled: assetQ.isSuccess, retry: false });
  const insuranceQ = useQuery({ queryKey: ["asset-insurance", id, token], queryFn: () => getInsurance(id, token), enabled: assetQ.isSuccess, retry: false });
  // shares the gallery's cache key — the hero is whichever linked photo matches heroDocumentId
  const photosQ = useQuery({ queryKey: ["docs-for", "asset", id, token], queryFn: () => documentsFor("asset", id, token), enabled: assetQ.isSuccess });
  const historyQ = useQuery({ queryKey: ["asset-history", id, token], queryFn: () => getAssetHistory(id, token), enabled: assetQ.isSuccess });
  const setHero = useMutation({ mutationFn: (docId: string) => setHeroPhoto(id, token, docId), onSuccess: () => { qc.invalidateQueries({ queryKey: ["asset", id] }); qc.invalidateQueries({ queryKey: ["activity", "asset", id] }); } });
  const isPrincipal = can("*", "admin");
  const canWrite = can("asset", "write");

  const back = <button type="button" onClick={() => navigate("/inventory")} {...stylex.props(styles.back)}>← Inventory</button>;
  if (assetQ.isPending) return <div {...stylex.props(styles.page)}>{back}<Loading label="Loading the asset…" /></div>;
  if (assetQ.isError) return <div {...stylex.props(styles.page)}>{back}<ErrorState error={assetQ.error} /></div>;

  const a = assetQ.data;
  const categoryName = (catsQ.data ?? []).find((c) => c.id === a.categoryId)?.name ?? "—";
  const attrs = Object.entries(a.attributes ?? {});
  const modeLabel = a.trackingMode === "grouped_quantity" ? `grouped ×${a.quantity}` : a.trackingMode.replace("_", " ");
  const heroUrl = (photosQ.data ?? []).find((d) => d.id === a.heroDocumentId)?.url;
  const locationLabel = a.propertyName ? [a.propertyName, a.locationName].filter(Boolean).join(" · ") : "—";
  const history = historyQ.data;

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      {logging && <LogEventModal id={id} token={token} onClose={() => setLogging(false)} />}
      {valuing && <RecordValuationModal id={id} token={token} onClose={() => setValuing(false)} />}
      {editing && <EditAssetModal asset={assetQ.data} categories={catsQ.data ?? []} token={token} onClose={() => setEditing(false)} />}
      {moving && <MoveModal asset={a} token={token} onClose={() => setMoving(false)} />}
      {changingCustody && <CustodyModal asset={a} token={token} onClose={() => setChangingCustody(false)} />}
      {restructuring && <RestructureModal asset={a} token={token} onClose={() => setRestructuring(false)} navigate={navigate} />}
      {heroUrl && (
        <div {...stylex.props(styles.heroWrap)} data-testid="asset-hero">
          <img {...stylex.props(styles.heroImg)} src={heroUrl} alt={`${a.title} — hero photo`} />
        </div>
      )}
      <div>
        {a.maker && <div {...stylex.props(styles.eyebrow)}>{a.maker}</div>}
        <h1 {...stylex.props(styles.title)}>{a.title}</h1>
        <div {...stylex.props(styles.pills)}>
          <Pill tone="accent">{categoryName}</Pill>
          <Pill>{modeLabel}</Pill>
          <Pill>{a.ownershipStatus}</Pill>
        </div>
        <div {...stylex.props(styles.tagsRow)}>
          <TagChips entityType="asset" entityId={id} readOnly={!can("asset", "write")} />
        </div>
      </div>

      <div {...stylex.props(styles.tabBar)} role="tablist" aria-label="Asset sections">
        {([["overview", "Overview"], ["timeline", "Timeline"], ["provenance", "Provenance"], ["value", "Value"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} {...stylex.props(styles.tab, tab === k && styles.tabActive)} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (<>
      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
          <div {...stylex.props(styles.cardPad)}>
            <MediaGallery
              targetType="asset"
              targetId={id}
              label="photos"
              readOnly={!canWrite}
              heroDocumentId={a.heroDocumentId}
              onSetHero={canWrite ? (docId) => setHero.mutate(docId) : undefined}
            />
          </div>
        </Card>
      </div>

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
          <div {...stylex.props(styles.cardPad)} data-testid="asset-groups">
            <AssetGroups assetId={id} readOnly={!canWrite} />
          </div>
        </Card>
      </div>

      <div {...stylex.props(styles.layout)}>
        <Card>
          <CardHeader>
            <CardTitle>Key facts</CardTitle>
            {can("asset", "write") && <button type="button" onClick={() => setEditing(true)} {...stylex.props(styles.action)}>Edit</button>}
            {can("asset", "write") && <button type="button" data-testid="restructure-btn" onClick={() => setRestructuring(true)} {...stylex.props(styles.action)}>Restructure</button>}
          </CardHeader>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Category</span><span {...stylex.props(styles.kvV)}>{categoryName}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Tracking</span><span {...stylex.props(styles.kvV)}>{modeLabel}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Quantity</span><span {...stylex.props(styles.kvV)}>{a.quantity}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Acquisition</span><span {...stylex.props(styles.kvV)}>{money(a.acquisitionCostMinor, a.acquisitionCurrency)}</span></div>
          {a.acquisitionDate && <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Acquired</span><span {...stylex.props(styles.kvV)}>{new Date(`${a.acquisitionDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div>}
          <div {...stylex.props(styles.kv)} data-testid="kv-location"><span {...stylex.props(styles.kvK)}>Location</span><span {...stylex.props(styles.kvV)}>{locationLabel}</span></div>
          <div {...stylex.props(styles.kv)} data-testid="kv-custody"><span {...stylex.props(styles.kvK)}>Custody</span><span {...stylex.props(styles.kvV)}>{humanCustody(a.custodyStatus)}</span></div>
          {canWrite && (
            <div {...stylex.props(styles.kvActions)}>
              <button type="button" {...stylex.props(styles.kvBtn)} data-testid="move-btn" onClick={() => setMoving(true)}><Move size={12} /> Move</button>
              <button type="button" {...stylex.props(styles.kvBtn)} data-testid="custody-btn" onClick={() => setChangingCustody(true)}>Change custody</button>
            </div>
          )}
          {(collectionsQ.data?.length ?? 0) > 0 && (
            <div {...stylex.props(styles.kv)} data-testid="asset-collections">
              <span {...stylex.props(styles.kvK)}>Collections</span>
              <span {...stylex.props(styles.kvV)}>{collectionsQ.data!.map((c) => c.name).join(", ")}</span>
            </div>
          )}
          {(a.marketValueMinor != null || a.insuredValueMinor != null) && (
            <>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Market value</span><span {...stylex.props(styles.kvV)}>{money(a.marketValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Insured value</span><span {...stylex.props(styles.kvV)}>{money(a.insuredValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
          {attrs.length === 0 ? (
            <EmptyState title="No specifications">Add typed attributes for this vertical.</EmptyState>
          ) : (
            attrs.map(([k, v]) => (
              <div key={k} {...stylex.props(styles.kv)} data-testid="spec-row">
                <span {...stylex.props(styles.kvK)}>{k.replace(/_/g, " ")}</span>
                <span {...stylex.props(styles.kvV)}>{String(v)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      </>)}

      {tab === "timeline" && (<>
      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <button type="button" onClick={() => setLogging(true)} {...stylex.props(styles.action)}><Plus size={13} /> Log event</button>
          </CardHeader>
          {timelineQ.isPending ? <Loading label="Loading the timeline…" />
            : timelineQ.isError ? <ErrorState error={timelineQ.error} />
            : timelineQ.data.events.length === 0 ? <EmptyState title="No events yet">Log acquisition, service, and movement events to build the timeline.</EmptyState>
            : (
              <>
                <Timeline
                  items={timelineQ.data.events.map((e) => ({
                    id: e.id,
                    type: e.eventType,
                    at: e.occurredAt,
                    title: e.eventType.replace(/_/g, " "),
                    subtitle: e.note,
                    party: e.party,
                    amountMinor: e.costMinor,
                    currency: e.currency,
                  }))}
                />
                <div {...stylex.props(styles.lifetime)}><span>Lifetime cost</span><span>{money(timelineQ.data.lifetimeCostMinor, "GBP")}</span></div>
              </>
            )}
        </Card>
      </div>

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <ActivityFeed targetType="asset" targetId={id} />
        </Card>
      </div>

      {((history?.location.length ?? 0) > 0 || (history?.custody.length ?? 0) > 0) && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader><CardTitle>Location &amp; custody history</CardTitle></CardHeader>
            {history!.location.map((h) => (
              <div {...stylex.props(styles.histRow)} key={h.id} data-testid="location-history-row">
                <div {...stylex.props(styles.histGrow)}>
                  <div {...stylex.props(styles.histTitle)}>Moved to {[h.propertyName, h.locationName].filter(Boolean).join(" · ") || "unspecified"}</div>
                  <div {...stylex.props(styles.histSub)}>{[h.movedBy && `by ${h.movedBy}`, h.note].filter(Boolean).join(" · ") || " "}</div>
                </div>
                <span {...stylex.props(styles.histWhen)}>{fmtWhen(h.movedAt)}</span>
              </div>
            ))}
            {history!.custody.map((h) => (
              <div {...stylex.props(styles.histRow)} key={h.id} data-testid="custody-history-row">
                <div {...stylex.props(styles.histGrow)}>
                  <div {...stylex.props(styles.histTitle)}>Custody → {humanCustody(h.custodyStatus)}</div>
                  <div {...stylex.props(styles.histSub)}>{[h.changedBy && `by ${h.changedBy}`, h.note].filter(Boolean).join(" · ") || " "}</div>
                </div>
                <span {...stylex.props(styles.histWhen)}>{fmtWhen(h.changedAt)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      </>)}

      {tab === "provenance" && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader><CardTitle>Provenance</CardTitle></CardHeader>
            <ProvenanceParties assetId={id} canEdit={canWrite} />
          </Card>
        </div>
      )}

      {tab === "value" && (<>
      {isPrincipal && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader>
              <CardTitle>Valuations</CardTitle>
              <button type="button" onClick={() => setValuing(true)} {...stylex.props(styles.action)}><Plus size={13} /> Record valuation</button>
            </CardHeader>
            {valuationsQ.isPending ? <Loading label="Loading valuations…" />
              : valuationsQ.isError ? <div {...stylex.props(styles.note)}>Valuations are Principal-only.</div>
              : valuationsQ.data.length === 0 ? <EmptyState title="No valuations recorded">Record a market or insured valuation to track this asset's worth over time.</EmptyState>
              : (() => {
                  const max = Math.max(1, ...valuationsQ.data.map((v) => v.amountMinor));
                  return valuationsQ.data.map((v) => (
                    <CardRow key={v.id} testId="valuation-row">
                      <div {...stylex.props(styles.grow)}>
                        <div {...stylex.props(styles.evTitle)}>{v.kind}</div>
                        <div {...stylex.props(styles.evSub)}>{v.valuedAt}</div>
                        <div {...stylex.props(styles.valBar)}><Bar pct={(v.amountMinor / max) * 100} /></div>
                      </div>
                      <span {...stylex.props(styles.evCost)}>{money(v.amountMinor, v.currency)}</span>
                    </CardRow>
                  ));
                })()}
          </Card>
        </div>
      )}

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Insurance &amp; warranty</CardTitle></CardHeader>
          {insuranceQ.isSuccess && (
            <div {...stylex.props(styles.kv)}>
              <span {...stylex.props(styles.kvK)}>Insurance</span>
              <span {...stylex.props(styles.kvV)}>
                {insuranceQ.data.insured
                  ? `${insuranceQ.data.policyRef ?? "Policy"}${insuranceQ.data.insuredValueMinor != null ? ` · ${money(insuranceQ.data.insuredValueMinor, "GBP")}` : ""}`
                  : "Not insured"}
              </span>
            </div>
          )}
          {warrantiesQ.isPending ? <Loading label="Loading warranties…" />
            : warrantiesQ.isError ? <ErrorState error={warrantiesQ.error} />
            : warrantiesQ.data.length === 0 ? <div {...stylex.props(styles.note)}>No warranties recorded. {insuranceQ.isError ? "Insurance is Principal-only." : ""}</div>
            : warrantiesQ.data.map((w) => (
                <CardRow key={w.id}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.evTitle)}>{w.provider ?? "Warranty"}</div>
                    <div {...stylex.props(styles.evSub)}>{w.endsOn ? `ends ${w.endsOn.slice(0, 10)}` : "—"}</div>
                  </div>
                </CardRow>
              ))}
        </Card>
      </div>
      </>)}
    </div>
  );
}

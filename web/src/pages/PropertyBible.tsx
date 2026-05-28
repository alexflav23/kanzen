import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill, type PillTone } from "../components/Pill";
import { Box, Plus, Check, X, Alert, Wrench, Documents as DocIcon, ChevronRight, ChevronDown, Move, Trash } from "../components/icons";
import { getProperty, patchProperty, archiveProperty, type PropertyDetail } from "../services/properties";
import { listLocations, createLocation, patchLocation, moveLocation, deleteLocation, type Location } from "../services/locations";
import { type AssetView } from "../services/assets";
import { listDefects, raiseDefect, setDefectStatus, type Defect } from "../services/defects";
import { listAssets } from "../services/assets";
import { listPlans } from "../services/maintenance";
import { listDocuments } from "../services/documents";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

type Tab = "overview" | "assets" | "rooms" | "maintenance" | "documents" | "defects";
const TABS: Tab[] = ["overview", "assets", "rooms", "maintenance", "documents", "defects"];
// Typed node kinds (F03 §6) — the location tree is more than rooms: it nests storage furniture too.
const KINDS = ["room", "area", "cabinet", "shelf", "case", "garage", "storage"] as const;

/** Bytes → compact human size for the Documents tab. */
function humanSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const COVERS = ["linear-gradient(135deg,#1B1F2E,#3B3F55)", "linear-gradient(135deg,#243B47,#3D6B7D)"];

const severityTone: Record<string, PillTone> = { high: "danger", medium: "warn", low: "default" };
const statusTone: Record<string, PillTone> = { open: "warn", in_progress: "accent", resolved: "default", wont_fix: "default" };
// Lifecycle transitions offered per current status (Manager+).
const NEXT: Record<string, { status: string; label: string }[]> = {
  open: [{ status: "in_progress", label: "Start" }, { status: "resolved", label: "Resolve" }, { status: "wont_fix", label: "Won't fix" }],
  in_progress: [{ status: "resolved", label: "Resolve" }, { status: "wont_fix", label: "Won't fix" }],
  resolved: [{ status: "open", label: "Reopen" }],
  wont_fix: [{ status: "open", label: "Reopen" }],
};

const styles = stylex.create({
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "14px" },
  cover: (bg: string) => ({ height: "200px", borderRadius: radius.lg, position: "relative", color: "#fff", marginBottom: "24px", backgroundImage: bg }),
  indent: (px: number) => ({ width: `${px}px`, flexShrink: 0 }),
  coverTop: { position: "absolute", top: "22px", left: "24px", display: "flex", gap: "8px" },
  coverBottom: { position: "absolute", bottom: "26px", left: "28px", right: "28px" },
  coverName: { fontSize: "34px", fontWeight: 600, letterSpacing: "-0.025em" },
  outlinePill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: radius.sm, fontSize: "12px", color: "#fff", backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", textTransform: "capitalize" },
  tabs: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  pad: { padding: "24px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "16px", fontWeight: 600 },
  meta: { display: "grid", gridTemplateColumns: "120px 1fr", rowGap: "10px", fontSize: "13.5px" },
  metaK: { color: colors.ink3 },
  metaV: { textTransform: "capitalize" },
  linkVal: { wordBreak: "break-word" },
  linkMuted: { color: colors.ink3, fontStyle: "italic" },
  note: { fontSize: "11.5px", color: colors.ink3, marginTop: "16px", lineHeight: 1.5 },
  glance: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" },
  glanceCell: { padding: "14px 16px", backgroundColor: colors.bgSunken, borderRadius: radius.md },
  glanceL: { fontSize: "12px", color: colors.ink3 },
  glanceN: { fontSize: "22px", fontWeight: 600, letterSpacing: "-0.018em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  full: { gridColumn: "1 / -1" },
  roomIco: { width: "34px", height: "34px", backgroundColor: colors.bgSunken, borderRadius: "10px", display: "grid", placeItems: "center", color: colors.ink2, overflow: "hidden" },
  thumb: { width: "34px", height: "34px", objectFit: "cover" },
  money: { fontSize: "13.5px", fontVariantNumeric: "tabular-nums", color: colors.ink2, marginLeft: "10px" },
  grow: { flex: 1, minWidth: 0 },
  sub: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  rowTitle: { fontSize: "13.5px", fontWeight: 500, color: colors.ink },
  desc: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  defectMeta: { display: "flex", gap: "8px", alignItems: "center" },
  actions: { display: "flex", gap: "6px", marginLeft: "10px" },
  miniBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  miniBtnDanger: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: radius.sm, border: 0, backgroundColor: colors.danger, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  expander: { width: "20px", height: "20px", flexShrink: 0, display: "grid", placeItems: "center", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", padding: 0 },
  expanderSpacer: { width: "20px", flexShrink: 0 },
  errorNote: { padding: "10px 12px", borderRadius: radius.sm, backgroundColor: colors.dangerSoft, color: colors.ink, fontSize: "12.5px", marginBottom: "12px" },
  adminRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" },
  headBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
});

function coverFor(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COVERS[n % COVERS.length];
}

/** A node + all of its descendants (used to forbid moving a node under its own subtree). */
function descendantIds(nodes: Location[], rootId: string): Set<string> {
  const byParent = new Map<string, Location[]>();
  for (const n of nodes) {
    const k = n.parentId ?? "__root";
    const arr = byParent.get(k) ?? [];
    arr.push(n);
    byParent.set(k, arr);
  }
  const acc = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of byParent.get(cur) ?? []) {
      acc.add(c.id);
      stack.push(c.id);
    }
  }
  return acc;
}

/** Rename/edit a node's particulars (name · floor · area · notes). */
function EditLocationModal({ node, propertyId, token, onClose }: { node: Location; propertyId: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(node.name);
  const [floor, setFloor] = useState(node.floor ?? "");
  const [area, setArea] = useState(node.area ?? "");
  const [notes, setNotes] = useState(node.notes ?? "");
  const mut = useMutation({
    mutationFn: () => patchLocation(node.id, { name: name.trim(), floor: floor.trim() || null, area: area.trim() || null, notes: notes.trim() || null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", propertyId] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="edit-room" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Edit {node.kind}</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Location name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Floor (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Area (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 42 m²" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Notes (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!name.trim() || mut.isPending}>{mut.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

/** Move/reparent a node — choices exclude the node itself and its descendants (no cycles). */
function MoveLocationModal({ node, nodes, propertyId, token, onClose }: { node: Location; nodes: Location[]; propertyId: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [parentId, setParentId] = useState(node.parentId ?? "");
  const blocked = useMemo(() => { const d = descendantIds(nodes, node.id); d.add(node.id); return d; }, [nodes, node.id]);
  const choices = nodes.filter((n) => !blocked.has(n.id));
  const mut = useMutation({
    mutationFn: () => moveLocation(node.id, parentId || null, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", propertyId] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="move-room" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Move {node.name}</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Inside</span>
          <select {...stylex.props(styles.control)} aria-label="New parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— top level</option>
            {choices.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select></label>
        {mut.isError && <div {...stylex.props(styles.errorNote)}>{mut.error instanceof Error ? mut.error.message : "Could not move"}</div>}
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mut.isPending}>{mut.isPending ? "Moving…" : "Move"}</button>
        </div>
      </form>
    </div>
  );
}

/** The property's nested location tree — expandable per-node item lists + (Manager+) rename/move/delete. */
function LocationTree({ nodes, assetsByLoc, propertyId, canManage, token }: { nodes: Location[]; assetsByLoc: Map<string, AssetView[]>; propertyId: string; canManage: boolean; token: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Location | null>(null);
  const [moving, setMoving] = useState<Location | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteLocation(id, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", propertyId] }); setConfirmDel(null); setError(null); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not delete this location"),
  });
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const render = (parentId: string | null, depth: number) => {
    const here = nodes.filter((n) => (n.parentId ?? null) === parentId);
    return here.map((n) => {
      const items = assetsByLoc.get(n.id) ?? [];
      const open = expanded.has(n.id);
      return (
        <div key={n.id}>
          <CardRow testId="room-row">
            <div {...stylex.props(styles.indent(depth * 22))} />
            {items.length > 0
              ? <button type="button" {...stylex.props(styles.expander)} aria-label={`${open ? "Collapse" : "Expand"} ${n.name}`} aria-expanded={open} onClick={() => toggle(n.id)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
              : <div {...stylex.props(styles.expanderSpacer)} />}
            <div {...stylex.props(styles.roomIco)}><Box size={16} /></div>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.rowTitle)}>{n.name}</div>
              <div {...stylex.props(styles.sub)}>{[n.kind, n.floor && `floor ${n.floor}`, n.area].filter(Boolean).join(" · ")}</div>
            </div>
            {items.length > 0 && <Pill tone="default">{`${items.length} item${items.length === 1 ? "" : "s"}`}</Pill>}
            {canManage && (
              <span {...stylex.props(styles.actions)}>
                <button type="button" {...stylex.props(styles.miniBtn)} aria-label={`Rename ${n.name}`} onClick={() => setEditing(n)}>Rename</button>
                <button type="button" {...stylex.props(styles.miniBtn)} aria-label={`Move ${n.name}`} onClick={() => setMoving(n)}><Move size={12} /> Move</button>
                {confirmDel === n.id
                  ? <>
                      <button type="button" {...stylex.props(styles.miniBtnDanger)} aria-label={`Confirm delete ${n.name}`} disabled={del.isPending} onClick={() => del.mutate(n.id)}>Confirm</button>
                      <button type="button" {...stylex.props(styles.miniBtn)} onClick={() => setConfirmDel(null)}>Cancel</button>
                    </>
                  : <button type="button" {...stylex.props(styles.miniBtn)} aria-label={`Delete ${n.name}`} onClick={() => { setError(null); setConfirmDel(n.id); }}><Trash size={12} /></button>}
              </span>
            )}
          </CardRow>
          {open && items.map((a) => (
            <CardRow key={a.id} testId="node-asset-row" onClick={() => navigate(`/inventory/${a.id}`)}>
              <div {...stylex.props(styles.indent(depth * 22 + 30))} />
              <div {...stylex.props(styles.roomIco)}>{a.heroUrl ? <img src={a.heroUrl} alt="" {...stylex.props(styles.thumb)} /> : <Box size={14} />}</div>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.rowTitle)}>{a.title}</div>
                <div {...stylex.props(styles.sub)}>{a.maker ?? "—"}</div>
              </div>
            </CardRow>
          ))}
          {render(n.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <>
      {error && <div {...stylex.props(styles.errorNote)} role="alert" data-testid="tree-error">{error}</div>}
      {render(null, 0)}
      {editing && <EditLocationModal node={editing} propertyId={propertyId} token={token} onClose={() => setEditing(null)} />}
      {moving && <MoveLocationModal node={moving} nodes={nodes} propertyId={propertyId} token={token} onClose={() => setMoving(null)} />}
    </>
  );
}

function ReportDefectModal({ propertyId, rooms, token, onClose }: { propertyId: string; rooms: Location[]; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [locationId, setLocationId] = useState("");
  const mut = useMutation({
    mutationFn: () => raiseDefect({ propertyId, locationId: locationId || null, title: title.trim(), description: description.trim() || null, severity }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["defects", propertyId] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="report-defect" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (title.trim()) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Report a defect</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>What's wrong</span>
          <input {...stylex.props(styles.control)} aria-label="Defect title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dishwasher not draining" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Details (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Details" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you've noticed" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Severity</span>
          <select {...stylex.props(styles.control)} aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {["low", "medium", "high"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Room (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Room" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">—</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!title.trim() || mut.isPending}>{mut.isPending ? "Reporting…" : "Report defect"}</button>
        </div>
      </form>
    </div>
  );
}

function AddRoomModal({ propertyId, rooms, token, onClose }: { propertyId: string; rooms: Location[]; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("room");
  const [floor, setFloor] = useState("");
  const [parentId, setParentId] = useState("");
  const mut = useMutation({
    mutationFn: () => createLocation({ propertyId, parentId: parentId || null, kind, name: name.trim(), floor: floor.trim() || null, area: null, notes: null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations", propertyId] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-room" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add a room</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Room name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wine Cellar" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Kind</span>
          <select {...stylex.props(styles.control)} aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Floor (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 52" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Inside (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Parent room" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— top level</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!name.trim() || mut.isPending}>{mut.isPending ? "Adding…" : "Add room"}</button>
        </div>
      </form>
    </div>
  );
}

const COUNTRY: Record<string, string> = { GB: "United Kingdom", SG: "Singapore", US: "United States", FR: "France", CH: "Switzerland", AE: "United Arab Emirates", IT: "Italy", ES: "Spain" };
const countryName = (j: string | null) => (j ? COUNTRY[j] ?? j : "—");

/** A linked-system reference (or a muted "Not linked"). Reference only — never a secret. */
function LinkVal({ v }: { v: string | null }) {
  return v ? <span {...stylex.props(styles.linkVal)}>{v}</span> : <span {...stylex.props(styles.linkMuted)}>Not linked</span>;
}

/** Edit a property's particulars (Manager+). Server rejects edits to an archived property (409). */
function EditPropertyModal({ p, token, onClose }: { p: PropertyDetail; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(p.name);
  const [address, setAddress] = useState(p.address ?? "");
  const [jurisdiction, setJurisdiction] = useState(p.jurisdiction ?? "");
  const [propType, setPropType] = useState(p.propType ?? "");
  const [ownership, setOwnership] = useState(p.ownership ?? "");
  const types = Array.from(new Set([p.propType, "apartment", "house", "villa", "townhouse", "land", "other"].filter(Boolean) as string[]));
  const owns = Array.from(new Set([p.ownership, "owned", "rented", "leased", "managed"].filter(Boolean) as string[]));
  const mut = useMutation({
    mutationFn: () => patchProperty(p.id, { name: name.trim(), address: address.trim() || null, jurisdiction: jurisdiction.trim() || null, propType: propType || null, ownership: ownership || null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["property", p.id] }); qc.invalidateQueries({ queryKey: ["properties"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="edit-property" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Edit property</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Property name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Address</span>
          <input {...stylex.props(styles.control)} aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Jurisdiction</span>
          <input {...stylex.props(styles.control)} aria-label="Jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. GB" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Type</span>
          <select {...stylex.props(styles.control)} aria-label="Type" value={propType} onChange={(e) => setPropType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Ownership</span>
          <select {...stylex.props(styles.control)} aria-label="Ownership" value={ownership} onChange={(e) => setOwnership(e.target.value)}>
            {owns.map((o) => <option key={o} value={o}>{o}</option>)}
          </select></label>
        {mut.isError && <div {...stylex.props(styles.errorNote)}>{mut.error instanceof Error ? mut.error.message : "Could not save"}</div>}
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!name.trim() || mut.isPending}>{mut.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

export function PropertyBible() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showEditProp, setShowEditProp] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const canManage = role != null && role !== "staff"; // status changes + add room + property admin are Manager+
  const archiveMut = useMutation({
    mutationFn: () => archiveProperty(id, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["properties"] }); navigate("/properties"); },
  });

  const detail = useQuery({ queryKey: ["property", id, token], queryFn: () => getProperty(id, token) });
  const rooms = useQuery({ queryKey: ["locations", id, token], queryFn: () => listLocations(id, token), enabled: detail.isSuccess });
  const defects = useQuery({ queryKey: ["defects", id, token], queryFn: () => listDefects(id, token), enabled: detail.isSuccess });
  // The property record: what's IN it (assets, server-scoped via the ?property= facet), what keeps it
  // running (maintenance plans), and its papers (documents) — the last two filtered to this property.
  const assets = useQuery({ queryKey: ["bible-assets", id, token], queryFn: () => listAssets(token, { property: id }), enabled: detail.isSuccess && (tab === "assets" || tab === "rooms") });
  const plans = useQuery({ queryKey: ["maintenance", token], queryFn: () => listPlans(token), enabled: detail.isSuccess && tab === "maintenance" });
  const docs = useQuery({ queryKey: ["documents", token], queryFn: () => listDocuments(token), enabled: detail.isSuccess && tab === "documents" });
  const propPlans = (plans.data ?? []).filter((pl) => pl.propertyId === id);
  const propDocs = (docs.data ?? []).filter((d) => d.propertyId === id);
  // group the property's assets by their current node — feeds the per-node item lists + count badges
  const assetsByLoc = useMemo(() => {
    const m = new Map<string, AssetView[]>();
    for (const a of assets.data ?? []) if (a.locationId) { const arr = m.get(a.locationId) ?? []; arr.push(a); m.set(a.locationId, arr); }
    return m;
  }, [assets.data]);
  const setStatus = useMutation({
    mutationFn: ({ defectId, status }: { defectId: string; status: string }) => setDefectStatus(defectId, status, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["defects", id] }),
  });

  const openDefects = (defects.data ?? []).filter((d) => d.status === "open" || d.status === "in_progress").length;

  const back = <button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.back)}>← All properties</button>;
  if (detail.isPending) return <div>{back}<Loading label="Loading the property…" /></div>;
  if (detail.isError) return <div>{back}<ErrorState error={detail.error} /></div>;
  const p = detail.data;
  const roomList = rooms.data ?? [];

  return (
    <div>
      {back}
      <div {...stylex.props(styles.cover(coverFor(p.id)))}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction ?? "—"}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.currency}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.status}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}><div {...stylex.props(styles.coverName)}>{p.name}</div></div>
      </div>

      <div {...stylex.props(styles.tabs)} aria-label="Property sections">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} {...stylex.props(styles.tab, tab === t && styles.tabActive)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
        {canManage && (
          <div {...stylex.props(styles.adminRow)}>
            <button type="button" {...stylex.props(styles.miniBtn)} onClick={() => setShowEditProp(true)}>Edit property</button>
            {p.status === "archived"
              ? <span {...stylex.props(styles.sub)}>Archived — read-only</span>
              : confirmArchive
                ? <>
                    <span {...stylex.props(styles.sub)}>Archive this property?</span>
                    <button type="button" {...stylex.props(styles.miniBtnDanger)} aria-label="Confirm archive" disabled={archiveMut.isPending} onClick={() => archiveMut.mutate()}>Confirm archive</button>
                    <button type="button" {...stylex.props(styles.miniBtn)} onClick={() => setConfirmArchive(false)}>Cancel</button>
                  </>
                : <button type="button" {...stylex.props(styles.miniBtn)} onClick={() => setConfirmArchive(true)}>Archive</button>}
          </div>
        )}
        <div {...stylex.props(styles.two)}>
          <Card style={styles.pad}>
            <div {...stylex.props(styles.eyebrow)}>Particulars</div>
            <div {...stylex.props(styles.meta)}>
              <span {...stylex.props(styles.metaK)}>Address</span><span>{p.address ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Country</span><span>{countryName(p.jurisdiction)}</span>
              <span {...stylex.props(styles.metaK)}>Type</span><span {...stylex.props(styles.metaV)}>{p.propType ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Ownership</span><span {...stylex.props(styles.metaV)}>{p.ownership ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Jurisdiction</span><span {...stylex.props(styles.metaV)}>{p.jurisdiction ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Currency</span><span>{p.currency}</span>
              <span {...stylex.props(styles.metaK)}>Building mgmt</span><span>{p.buildingManagement ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Status</span><span {...stylex.props(styles.metaV)}>{p.status}</span>
              <span {...stylex.props(styles.metaK)}>Open defects</span><span>{openDefects}</span>
            </div>
          </Card>
          <Card style={styles.pad}>
            <div {...stylex.props(styles.eyebrow)}>Linked systems</div>
            <div {...stylex.props(styles.meta)}>
              <span {...stylex.props(styles.metaK)}>Task project</span><LinkVal v={p.linked.taskProject} />
              <span {...stylex.props(styles.metaK)}>Calendar</span><LinkVal v={p.linked.googleCalendar} />
              <span {...stylex.props(styles.metaK)}>Drive folder</span><LinkVal v={p.linked.driveFolder} />
              <span {...stylex.props(styles.metaK)}>1Password</span><LinkVal v={p.linked.onepasswordVault} />
            </div>
            <div {...stylex.props(styles.note)}>References only — Kanzen stores names and links, never credentials or secrets.</div>
          </Card>
          <Card style={styles.full}>
            <div {...stylex.props(styles.pad)}>
              <div {...stylex.props(styles.eyebrow)}>At a glance</div>
              <div {...stylex.props(styles.glance)}>
                {([["Rooms", p.rooms], ["Assets", p.assets], ["Bills", p.bills], ["Vendors", p.vendors]] as const).map(([l, v]) => (
                  <div key={l} {...stylex.props(styles.glanceCell)}>
                    <div {...stylex.props(styles.glanceL)}>{l}</div>
                    <div {...stylex.props(styles.glanceN)}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
        </>
      )}

      {tab === "assets" && (
        <Card>
          <CardHeader>
            <CardTitle>Assets · {assets.data?.length ?? 0}</CardTitle>
            <button type="button" {...stylex.props(styles.miniBtn)} onClick={() => navigate(`/inventory?property=${p.id}`)}>Open in registry →</button>
          </CardHeader>
          {assets.isPending ? <Loading label="Loading assets…" />
            : assets.isError ? <ErrorState error={assets.error} />
            : assets.data.length === 0 ? <EmptyState title="No assets here">Items located in this property will appear here.</EmptyState>
            : assets.data.map((a) => (
                <CardRow key={a.id} testId="bible-asset-row" onClick={() => navigate(`/inventory/${a.id}`)}>
                  <div {...stylex.props(styles.roomIco)}>{a.heroUrl ? <img src={a.heroUrl} alt="" {...stylex.props(styles.thumb)} /> : <Box size={16} />}</div>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.rowTitle)}>{a.title}</div>
                    <div {...stylex.props(styles.sub)}>{a.maker ?? "—"}</div>
                  </div>
                  {a.acquisitionCostMinor != null && a.acquisitionCurrency && (
                    <span {...stylex.props(styles.money)}>{fmtMoney(a.acquisitionCostMinor, a.acquisitionCurrency)}</span>
                  )}
                </CardRow>
              ))}
        </Card>
      )}

      {tab === "rooms" && (
        <Card>
          <CardHeader>
            <CardTitle>Rooms · {roomList.length}</CardTitle>
            {canManage && <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowAddRoom(true)}><Plus size={14} /> Add room</button>}
          </CardHeader>
          {rooms.isPending ? <Loading label="Loading rooms…" />
            : rooms.isError ? <ErrorState error={rooms.error} />
            : roomList.length === 0 ? <EmptyState title="No rooms yet">Add rooms and sub-locations to map this property.</EmptyState>
            : <LocationTree nodes={roomList} assetsByLoc={assetsByLoc} propertyId={p.id} canManage={canManage} token={token} />}
        </Card>
      )}

      {tab === "maintenance" && (
        <Card>
          <CardHeader><CardTitle>Maintenance · {propPlans.length}</CardTitle></CardHeader>
          {plans.isPending ? <Loading label="Loading maintenance…" />
            : plans.isError ? <ErrorState error={plans.error} />
            : propPlans.length === 0 ? <EmptyState title="No maintenance plans">Recurring upkeep for this property will appear here.</EmptyState>
            : propPlans.map((pl) => (
                <CardRow key={pl.id} testId="bible-plan-row">
                  <div {...stylex.props(styles.roomIco)}><Wrench size={16} /></div>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.rowTitle)}>{pl.title ?? "Untitled plan"}</div>
                    <div {...stylex.props(styles.sub)}>{[pl.frequency, pl.vendor].filter(Boolean).join(" · ")}</div>
                  </div>
                  {pl.nextDue && <Pill tone={pl.dueSoon ? "warn" : "default"}>{pl.dueSoon ? "due soon · " : ""}{pl.nextDue}</Pill>}
                </CardRow>
              ))}
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader><CardTitle>Documents · {propDocs.length}</CardTitle></CardHeader>
          {docs.isPending ? <Loading label="Loading documents…" />
            : docs.isError ? <ErrorState error={docs.error} />
            : propDocs.length === 0 ? <EmptyState title="No documents">Papers filed against this property — deeds, certificates, warranties — appear here.</EmptyState>
            : propDocs.map((d) => (
                <CardRow key={d.id} testId="bible-doc-row">
                  <div {...stylex.props(styles.roomIco)}><DocIcon size={16} /></div>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.rowTitle)}>{d.name}</div>
                    <div {...stylex.props(styles.sub)}>{[d.category, humanSize(d.sizeBytes)].filter(Boolean).join(" · ")}</div>
                  </div>
                  {d.immutable && <Pill tone="default">original</Pill>}
                </CardRow>
              ))}
        </Card>
      )}

      {tab === "defects" && (
        <Card>
          <CardHeader>
            <CardTitle>Defects · {defects.data?.length ?? 0}</CardTitle>
            {role != null && <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowReport(true)}><Alert size={13} /> Report defect</button>}
          </CardHeader>
          {defects.isPending ? <Loading label="Loading defects…" />
            : defects.isError ? <ErrorState error={defects.error} />
            : defects.data.length === 0 ? <EmptyState title="No defects">Nothing reported for this property.</EmptyState>
            : defects.data.map((d: Defect) => (
                <CardRow key={d.id} testId="defect-row">
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.rowTitle)}>{d.title}</div>
                    {d.description && <div {...stylex.props(styles.desc)}>{d.description}</div>}
                  </div>
                  <div {...stylex.props(styles.defectMeta)}>
                    <Pill tone={severityTone[d.severity] ?? "default"}>{d.severity}</Pill>
                    <Pill tone={statusTone[d.status] ?? "default"}>{d.status.replace("_", " ")}</Pill>
                  </div>
                  {canManage && (
                    <span {...stylex.props(styles.actions)}>
                      {(NEXT[d.status] ?? []).map((t) => (
                        <button key={t.status} type="button" {...stylex.props(styles.miniBtn)} aria-label={`${t.label} ${d.title}`} disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ defectId: d.id, status: t.status })}>
                          {t.status === "resolved" ? <Check size={12} /> : t.status === "wont_fix" ? <X size={12} /> : null} {t.label}
                        </button>
                      ))}
                    </span>
                  )}
                </CardRow>
              ))}
        </Card>
      )}

      {showReport && <ReportDefectModal propertyId={p.id} rooms={roomList} token={token} onClose={() => setShowReport(false)} />}
      {showAddRoom && <AddRoomModal propertyId={p.id} rooms={roomList} token={token} onClose={() => setShowAddRoom(false)} />}
      {showEditProp && <EditPropertyModal p={p} token={token} onClose={() => setShowEditProp(false)} />}
    </div>
  );
}

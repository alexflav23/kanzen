import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill, type PillTone } from "../components/Pill";
import { Box, Plus, Check, X, Alert } from "../components/icons";
import { getProperty } from "../services/properties";
import { listLocations, createLocation, type Location } from "../services/locations";
import { listDefects, raiseDefect, setDefectStatus, type Defect } from "../services/defects";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

type Tab = "overview" | "rooms" | "defects";
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
  cover: { height: "200px", borderRadius: radius.lg, position: "relative", color: "#fff", marginBottom: "24px" },
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
  glance: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" },
  glanceCell: { padding: "14px 16px", backgroundColor: colors.bgSunken, borderRadius: radius.md },
  glanceL: { fontSize: "12px", color: colors.ink3 },
  glanceN: { fontSize: "22px", fontWeight: 600, letterSpacing: "-0.018em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  full: { gridColumn: "1 / -1" },
  roomIco: { width: "34px", height: "34px", backgroundColor: colors.bgSunken, borderRadius: "10px", display: "grid", placeItems: "center", color: colors.ink2 },
  grow: { flex: 1, minWidth: 0 },
  sub: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  rowTitle: { fontSize: "13.5px", fontWeight: 500, color: colors.ink },
  desc: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  defectMeta: { display: "flex", gap: "8px", alignItems: "center" },
  actions: { display: "flex", gap: "6px", marginLeft: "10px" },
  miniBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12px", fontWeight: 500 },
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

/** A node + its descendants, indented by depth. */
function RoomNodes({ nodes, parentId, depth }: { nodes: Location[]; parentId: string | null; depth: number }) {
  const here = nodes.filter((n) => n.parentId === parentId);
  return (
    <>
      {here.map((n) => (
        <div key={n.id}>
          <CardRow>
            <div style={{ width: `${depth * 22}px` }} />
            <div {...stylex.props(styles.roomIco)}><Box size={16} /></div>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.rowTitle)}>{n.name}</div>
              <div {...stylex.props(styles.sub)}>{[n.kind, n.floor && `floor ${n.floor}`, n.area].filter(Boolean).join(" · ")}</div>
            </div>
          </CardRow>
          <RoomNodes nodes={nodes} parentId={n.id} depth={depth + 1} />
        </div>
      ))}
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
            {["room", "area"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Floor (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 52" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Inside (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Parent room" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— top level</option>
            {rooms.filter((r) => r.kind === "room").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!name.trim() || mut.isPending}>{mut.isPending ? "Adding…" : "Add room"}</button>
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
  const canManage = role != null && role !== "staff"; // status changes + add room are Manager+

  const detail = useQuery({ queryKey: ["property", id, token], queryFn: () => getProperty(id, token) });
  const rooms = useQuery({ queryKey: ["locations", id, token], queryFn: () => listLocations(id, token), enabled: detail.isSuccess });
  const defects = useQuery({ queryKey: ["defects", id, token], queryFn: () => listDefects(id, token), enabled: detail.isSuccess });
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
      <div {...stylex.props(styles.cover)} style={{ background: coverFor(p.id) }}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction ?? "—"}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.currency}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.status}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}><div {...stylex.props(styles.coverName)}>{p.name}</div></div>
      </div>

      <div {...stylex.props(styles.tabs)} aria-label="Property sections">
        {(["overview", "rooms", "defects"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} {...stylex.props(styles.tab, tab === t && styles.tabActive)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div {...stylex.props(styles.two)}>
          <Card style={styles.pad}>
            <div {...stylex.props(styles.eyebrow)}>Particulars</div>
            <div {...stylex.props(styles.meta)}>
              <span {...stylex.props(styles.metaK)}>Jurisdiction</span><span {...stylex.props(styles.metaV)}>{p.jurisdiction ?? "—"}</span>
              <span {...stylex.props(styles.metaK)}>Currency</span><span>{p.currency}</span>
              <span {...stylex.props(styles.metaK)}>Status</span><span {...stylex.props(styles.metaV)}>{p.status}</span>
              <span {...stylex.props(styles.metaK)}>Open defects</span><span>{openDefects}</span>
            </div>
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
            : <RoomNodes nodes={roomList} parentId={null} depth={0} />}
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
    </div>
  );
}

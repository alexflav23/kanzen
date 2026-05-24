import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill, type PillTone } from "../components/Pill";
import { Box } from "../components/icons";
import { getProperty } from "../services/properties";
import { listLocations, type Location } from "../services/locations";
import { listDefects } from "../services/defects";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

type Tab = "overview" | "rooms" | "defects";
const COVERS = ["linear-gradient(135deg,#1B1F2E,#3B3F55)", "linear-gradient(135deg,#243B47,#3D6B7D)"];

const severityTone: Record<string, PillTone> = { high: "danger", medium: "warn", low: "default" };
const statusTone: Record<string, PillTone> = { open: "warn", in_progress: "accent", resolved: "default", wont_fix: "default" };

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
  grow: { flex: 1 },
  sub: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  rowTitle: { fontSize: "13.5px", fontWeight: 500 },
  defectMeta: { display: "flex", gap: "8px", alignItems: "center" },
});

function coverFor(id: string): string {
  // deterministic from the id so a property always reads the same
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
              <div {...stylex.props(styles.sub)}>
                {[n.kind, n.floor && `floor ${n.floor}`, n.area].filter(Boolean).join(" · ")}
              </div>
            </div>
          </CardRow>
          <RoomNodes nodes={nodes} parentId={n.id} depth={depth + 1} />
        </div>
      ))}
    </>
  );
}

export function PropertyBible() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const detail = useQuery({ queryKey: ["property", id, token], queryFn: () => getProperty(id, token) });
  const rooms = useQuery({ queryKey: ["locations", id, token], queryFn: () => listLocations(id, token), enabled: detail.isSuccess });
  const defects = useQuery({ queryKey: ["defects", id, token], queryFn: () => listDefects(id, token), enabled: detail.isSuccess });

  const back = (
    <button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.back)}>← All properties</button>
  );

  if (detail.isPending) return <div>{back}<Loading label="Loading the property…" /></div>;
  if (detail.isError) return <div>{back}<ErrorState error={detail.error} /></div>;
  const p = detail.data;

  return (
    <div>
      {back}
      <div {...stylex.props(styles.cover)} style={{ background: coverFor(p.id) }}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction ?? "—"}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.currency}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.status}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}>
          <div {...stylex.props(styles.coverName)}>{p.name}</div>
        </div>
      </div>

      <div {...stylex.props(styles.tabs)} role="tablist" aria-label="Property sections">
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
          <CardHeader><CardTitle>Rooms · {rooms.data?.length ?? 0}</CardTitle></CardHeader>
          {rooms.isPending ? <Loading label="Loading rooms…" />
            : rooms.isError ? <ErrorState error={rooms.error} />
            : rooms.data.length === 0 ? <EmptyState title="No rooms yet">Add rooms and sub-locations to map this property.</EmptyState>
            : <RoomNodes nodes={rooms.data} parentId={null} depth={0} />}
        </Card>
      )}

      {tab === "defects" && (
        <Card>
          <CardHeader><CardTitle>Defects · {defects.data?.length ?? 0}</CardTitle></CardHeader>
          {defects.isPending ? <Loading label="Loading defects…" />
            : defects.isError ? <ErrorState error={defects.error} />
            : defects.data.length === 0 ? <EmptyState title="No defects">Nothing reported for this property.</EmptyState>
            : defects.data.map((d) => (
                <CardRow key={d.id}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.rowTitle)}>{d.title}</div>
                    {d.description && <div {...stylex.props(styles.sub)}>{d.description}</div>}
                  </div>
                  <div {...stylex.props(styles.defectMeta)}>
                    <Pill tone={severityTone[d.severity] ?? "default"}>{d.severity}</Pill>
                    <Pill tone={statusTone[d.status] ?? "default"}>{d.status.replace("_", " ")}</Pill>
                  </div>
                </CardRow>
              ))}
        </Card>
      )}
    </div>
  );
}

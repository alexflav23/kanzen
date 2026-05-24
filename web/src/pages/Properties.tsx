import * as stylex from "@stylexjs/stylex";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus } from "../components/icons";
import { listProperties, type Property } from "../services/properties";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

// Deterministic cover so each property reads consistently (rich imagery lands with F05).
const COVERS = ["linear-gradient(135deg,#1B1F2E,#3B3F55)", "linear-gradient(135deg,#243B47,#3D6B7D)"];

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "28px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" },
  card: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, overflow: "hidden", padding: 0, textAlign: "left", cursor: "pointer", color: colors.ink },
  cover: { height: "180px", position: "relative", color: "#fff" },
  coverTop: { position: "absolute", top: "16px", left: "18px", right: "18px", display: "flex", justifyContent: "space-between" },
  coverBottom: { position: "absolute", bottom: "18px", left: "20px", right: "20px" },
  coverName: { fontSize: "24px", fontWeight: 600, letterSpacing: "-0.018em" },
  outlinePill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: radius.sm, fontSize: "12px", color: "#fff", backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", textTransform: "capitalize" },
  stats: { padding: "18px 22px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" },
  statL: { fontSize: "11px", color: colors.ink3 },
  statN: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.014em", marginTop: "2px", fontVariantNumeric: "tabular-nums" },
});

function PropertyCard({ p, cover, onOpen }: { p: Property; cover: string; onOpen: () => void }) {
  const stats: [string, string][] = [
    ["Currency", p.currency],
    ["Rooms", "—"],
    ["Assets", "—"],
    ["Vendors", "—"],
  ];
  return (
    <button type="button" data-testid="property-card" onClick={onOpen} {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cover)} style={{ background: cover }}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction ?? "—"}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.status}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}>
          <div {...stylex.props(styles.coverName)}>{p.name}</div>
        </div>
      </div>
      <div {...stylex.props(styles.stats)}>
        {stats.map(([l, v]) => (
          <div key={l}>
            <div {...stylex.props(styles.statL)}>{l}</div>
            <div {...stylex.props(styles.statN)}>{v}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

export function Properties() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["properties", token],
    queryFn: () => listProperties(token),
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>The Bibles</div>
          <h1 {...stylex.props(styles.title)}>Properties</h1>
          <div {...stylex.props(styles.desc)}>One record per property. The full picture: rooms, assets, systems, documents.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)}><Plus size={14} /> Add property</button>
      </header>

      {isPending ? (
        <Loading label="Loading properties…" />
      ) : isError ? (
        <ErrorState error={error} />
      ) : data.length === 0 ? (
        <EmptyState title="No properties yet">Add your first property to start its record.</EmptyState>
      ) : (
        <div {...stylex.props(styles.grid)}>
          {data.map((p, i) => (
            <PropertyCard key={p.id} p={p} cover={COVERS[i % COVERS.length]} onOpen={() => navigate(`/properties/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

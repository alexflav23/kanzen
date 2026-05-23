import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "../components/Pill";
import { PROPERTIES, type MockProperty } from "../data/mockProperties";

const styles = stylex.create({
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  card: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "18px" },
  name: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em" },
  addr: { fontSize: "13px", color: colors.ink3, marginBottom: "12px" },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginTop: "8px" },
  statN: { fontSize: "18px", fontWeight: 600 },
  statL: { fontSize: "11px", color: colors.ink3 },
});

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div {...stylex.props(styles.statN)} className="num">{n}</div>
      <div {...stylex.props(styles.statL)}>{label}</div>
    </div>
  );
}

function PropertyCard({ p }: { p: MockProperty }) {
  return (
    <div data-testid="property-card" {...stylex.props(styles.card)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span {...stylex.props(styles.name)}>{p.name}</span>
        <Pill>{p.jurisdiction}</Pill>
      </div>
      <div {...stylex.props(styles.addr)}>{p.address}</div>
      <div {...stylex.props(styles.stats)}>
        <Stat n={p.rooms} label="Rooms" />
        <Stat n={p.assets} label="Assets" />
        <Stat n={p.bills} label="Bills" />
        <Stat n={p.vendors} label="Vendors" />
      </div>
    </div>
  );
}

export function Properties() {
  return (
    <div>
      <h1 {...stylex.props(styles.title)}>Properties</h1>
      <div {...stylex.props(styles.grid)}>
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

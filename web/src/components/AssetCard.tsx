import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../styles/tokens.stylex";
import { Pill } from "./Pill";
import { Box, Pin, Wrench, Layers } from "./icons";
import { fmtMoneyShort, propName, type MockAsset } from "../data/mockInventory";

const styles = stylex.create({
  card: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, overflow: "hidden", padding: 0, textAlign: "left", cursor: "pointer", color: colors.ink },
  photo: { height: "150px", display: "grid", placeItems: "center", position: "relative", color: "rgba(255,255,255,0.45)" },
  badge: { position: "absolute", top: "10px", display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: radius.sm, fontSize: "11px", color: "#fff", backgroundColor: "rgba(255,255,255,0.20)" },
  badgeL: { left: "10px" },
  badgeR: { right: "10px" },
  body: { padding: "14px 16px 16px" },
  maker: { fontSize: "11px", color: colors.ink3, marginBottom: "2px" },
  title: { fontSize: "14px", fontWeight: 500, marginBottom: "8px", lineHeight: 1.3, minHeight: "36px" },
  valRow: { display: "flex", alignItems: "center", gap: "6px" },
  val: { fontSize: "14px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1 },
  loc: { marginTop: "6px", fontSize: "11px", color: colors.ink3, display: "flex", alignItems: "center", gap: "4px" },
});

export function AssetCard({ asset, onOpen }: { asset: MockAsset; onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid="asset-card" {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.photo)} style={{ background: asset.fill }}>
        <Box size={42} />
        {asset.condition === "Service" && (
          <span {...stylex.props(styles.badge, styles.badgeL)}><Wrench size={11} /> At service</span>
        )}
        {asset.mode === "grouped-quantity" && (
          <span {...stylex.props(styles.badge, styles.badgeR)}>×{asset.qty}</span>
        )}
        {asset.mode === "structured-set" && (
          <span {...stylex.props(styles.badge, styles.badgeR)}><Layers size={11} /> set</span>
        )}
      </div>
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.maker)}>{asset.maker}</div>
        <div {...stylex.props(styles.title)}>{asset.title}</div>
        <div {...stylex.props(styles.valRow)}>
          <span {...stylex.props(styles.val)}>{fmtMoneyShort(asset.current, asset.currency)}</span>
          <span {...stylex.props(styles.grow)} />
          {asset.tags.slice(0, 1).map((t) => <Pill key={t}>{t}</Pill>)}
        </div>
        <div {...stylex.props(styles.loc)}>
          <Pin size={10} /> {propName(asset.propId)} · {asset.sub}
        </div>
      </div>
    </button>
  );
}

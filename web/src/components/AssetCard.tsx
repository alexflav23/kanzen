import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../styles/tokens.stylex";
import type { MockAsset } from "../data/mockInventory";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

const styles = stylex.create({
  card: {
    border: `1px solid ${colors.line}`,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElev,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  maker: { fontSize: "11px", color: colors.ink3 },
  title: { fontSize: "14px", fontWeight: 500 },
  value: { fontSize: "14px", fontWeight: 600, marginTop: "6px" },
});

export function AssetCard({ asset }: { asset: MockAsset }) {
  return (
    <div data-testid="asset-card" {...stylex.props(styles.card)}>
      <span {...stylex.props(styles.maker)}>{asset.maker}</span>
      <span {...stylex.props(styles.title)}>{asset.title}</span>
      <span {...stylex.props(styles.value)} className="num">
        {gbp.format(asset.valueGbp)}
      </span>
    </div>
  );
}

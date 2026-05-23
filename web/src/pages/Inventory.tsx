import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { AssetCard } from "../components/AssetCard";
import { ASSETS, CATEGORIES } from "../data/mockInventory";

const styles = stylex.create({
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "16px" },
  filters: { display: "flex", gap: "6px", marginBottom: "16px" },
  chip: {
    padding: "4px 12px",
    borderRadius: radius.sm,
    border: `1px solid ${colors.line}`,
    backgroundColor: colors.bgElev,
    color: colors.ink2,
    fontSize: "13px",
    cursor: "pointer",
  },
  chipActive: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" },
});

export function Inventory() {
  const [cat, setCat] = useState<string>("All");
  const shown = cat === "All" ? ASSETS : ASSETS.filter((a) => a.category === cat);

  return (
    <div>
      <h1 {...stylex.props(styles.title)}>Inventory</h1>
      <div {...stylex.props(styles.filters)} role="tablist" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === cat}
            onClick={() => setCat(c)}
            {...stylex.props(styles.chip, c === cat && styles.chipActive)}
          >
            {c}
          </button>
        ))}
      </div>
      <div {...stylex.props(styles.grid)} data-testid="asset-grid">
        {shown.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </div>
    </div>
  );
}

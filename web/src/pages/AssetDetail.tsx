import * as stylex from "@stylexjs/stylex";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { getAsset } from "../services/assets";
import { listCategories } from "../services/categories";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  page: { maxWidth: "1100px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "6px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  pills: { display: "flex", gap: "6px", marginTop: "10px", marginBottom: "24px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  kv: { display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  kvK: { color: colors.ink3, textTransform: "capitalize" },
  kvV: { fontWeight: 500, textTransform: "capitalize" },
  note: { padding: "14px 20px", fontSize: "12.5px", color: colors.ink3 },
});

function money(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "GBP" }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export function AssetDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const assetQ = useQuery({ queryKey: ["asset", id, token], queryFn: () => getAsset(id, token) });
  const catsQ = useQuery({ queryKey: ["categories", token], queryFn: () => listCategories(token), enabled: assetQ.isSuccess });

  const back = <button type="button" onClick={() => navigate("/inventory")} {...stylex.props(styles.back)}>← Inventory</button>;
  if (assetQ.isPending) return <div {...stylex.props(styles.page)}>{back}<Loading label="Loading the asset…" /></div>;
  if (assetQ.isError) return <div {...stylex.props(styles.page)}>{back}<ErrorState error={assetQ.error} /></div>;

  const a = assetQ.data;
  const categoryName = (catsQ.data ?? []).find((c) => c.id === a.categoryId)?.name ?? "—";
  const attrs = Object.entries(a.attributes ?? {});
  const modeLabel = a.trackingMode === "grouped_quantity" ? `grouped ×${a.quantity}` : a.trackingMode.replace("_", " ");

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      <div>
        {a.maker && <div {...stylex.props(styles.eyebrow)}>{a.maker}</div>}
        <h1 {...stylex.props(styles.title)}>{a.title}</h1>
        <div {...stylex.props(styles.pills)}>
          <Pill tone="accent">{categoryName}</Pill>
          <Pill>{modeLabel}</Pill>
          <Pill>{a.ownershipStatus}</Pill>
        </div>
      </div>

      <div {...stylex.props(styles.layout)}>
        <Card>
          <CardHeader><CardTitle>Key facts</CardTitle></CardHeader>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Category</span><span {...stylex.props(styles.kvV)}>{categoryName}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Tracking</span><span {...stylex.props(styles.kvV)}>{modeLabel}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Quantity</span><span {...stylex.props(styles.kvV)}>{a.quantity}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Acquisition</span><span {...stylex.props(styles.kvV)}>{money(a.acquisitionCostMinor, a.acquisitionCurrency)}</span></div>
          {(a.marketValueMinor != null || a.insuredValueMinor != null) && (
            <>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Market value</span><span {...stylex.props(styles.kvV)}>{money(a.marketValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Insured value</span><span {...stylex.props(styles.kvV)}>{money(a.insuredValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
            </>
          )}
          <div {...stylex.props(styles.note)}>Valuation is Principal-only; documents arrive with F05.</div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
          {attrs.length === 0 ? (
            <EmptyState title="No specifications">Add typed attributes for this vertical (F22).</EmptyState>
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
    </div>
  );
}

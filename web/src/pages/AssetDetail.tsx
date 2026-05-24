import * as stylex from "@stylexjs/stylex";
import { useNavigate, useParams } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { ChevronRight, Pin } from "../components/icons";
import { ASSETS, categoryName, propName, fmtMoneyShort } from "../data/mockInventory";

const styles = stylex.create({
  page: { maxWidth: "1100px" },
  backWrap: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "6px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  pills: { display: "flex", gap: "6px", marginTop: "10px" },
  hero: { display: "flex", alignItems: "flex-end", gap: "24px", marginTop: "16px", marginBottom: "24px" },
  photo: { width: "200px", height: "150px", borderRadius: radius.lg, flexShrink: 0 },
  val: { fontSize: "32px", fontWeight: 600, letterSpacing: "-0.022em", fontVariantNumeric: "tabular-nums" },
  sub: { fontSize: "13px", color: colors.ink3, marginTop: "2px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  kv: { display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  kvK: { color: colors.ink3 },
  kvV: { fontWeight: 500 },
  grow: { flex: 1 },
  num: { fontVariantNumeric: "tabular-nums" },
  colStack: { display: "flex", flexDirection: "column", gap: "24px" },
  b135: { fontSize: "13.5px" },
  semibold: { fontWeight: 600 },
});

type Val = { date: string; value: number; by: string };
type Doc = { name: string; kind: string };

export function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const asset = ASSETS.find((a) => a.id === id);

  if (!asset) {
    return (
      <div>
        <button type="button" onClick={() => navigate("/inventory")} {...stylex.props(styles.backWrap)}>← Inventory</button>
        <p>Asset not found.</p>
      </div>
    );
  }

  const valuations: Val[] = [
    { date: asset.acquired, value: Math.round(asset.current * 0.7), by: "Purchase price" },
    { date: "2022-01-15", value: Math.round(asset.current * 0.88), by: "Appraisal — Bonhams" },
    { date: "2024-09-01", value: asset.current, by: "Market estimate" },
  ];
  const docs: Doc[] = [
    { name: "Purchase receipt.pdf", kind: "Proof of purchase" },
    { name: "Insurance schedule.pdf", kind: "Policy" },
    ...(asset.condition === "Service" ? [{ name: "Service order — 2025.pdf", kind: "Maintenance" }] : []),
  ];

  return (
    <div {...stylex.props(styles.page)}>
      <button type="button" onClick={() => navigate("/inventory")} {...stylex.props(styles.backWrap)}>← Inventory</button>

      <div>
        <div {...stylex.props(styles.eyebrow)}>{asset.maker}</div>
        <h1 {...stylex.props(styles.title)}>{asset.title}</h1>
        <div {...stylex.props(styles.pills)}>
          <Pill tone="accent">{categoryName(asset.category)}</Pill>
          <Pill tone={asset.condition === "Service" ? "warn" : "default"}>{asset.condition}</Pill>
          <Pill>{asset.status}</Pill>
        </div>
      </div>

      <div {...stylex.props(styles.hero)}>
        <div {...stylex.props(styles.photo)} style={{ background: asset.fill }} />
        <div>
          <div {...stylex.props(styles.val)}>{fmtMoneyShort(asset.current, asset.currency)}</div>
          <div {...stylex.props(styles.sub)}>Current estimate · insured {fmtMoneyShort(asset.insured, asset.currency)}</div>
        </div>
      </div>

      <div {...stylex.props(styles.layout)}>
        <div {...stylex.props(styles.colStack)}>
          <Card>
            <CardHeader><CardTitle>Key facts</CardTitle></CardHeader>
            <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Acquired</span><span {...stylex.props(styles.kvV)}>{asset.acquired}</span></div>
            <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Location</span><span {...stylex.props(styles.kvV)}>{propName(asset.propId)} · {asset.sub}</span></div>
            <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Status</span><span {...stylex.props(styles.kvV)}>{asset.status}</span></div>
            <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Tags</span><span {...stylex.props(styles.kvV)}>{asset.tags.length ? asset.tags.join(", ") : "—"}</span></div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Valuation history</CardTitle></CardHeader>
            {valuations.map((v) => (
              <CardRow key={v.date}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.b135)}>{v.by}</div>
                  <div {...stylex.props(styles.sub)}>{v.date}</div>
                </div>
                <span {...stylex.props(styles.num, styles.semibold)}>{fmtMoneyShort(v.value, asset.currency)}</span>
              </CardRow>
            ))}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Attached documents</CardTitle></CardHeader>
            {docs.map((d) => (
              <CardRow key={d.name}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.b135)}>{d.name}</div>
                  <div {...stylex.props(styles.sub)}>{d.kind}</div>
                </div>
                <ChevronRight size={14} />
              </CardRow>
            ))}
            <CardRow>
              <Pin size={12} />
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.sub)}>Stored immutably in S3 — originals are never edited.</div>
              </div>
            </CardRow>
          </Card>
        </div>
      </div>
    </div>
  );
}

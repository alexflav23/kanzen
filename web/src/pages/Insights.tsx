import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { fmtMoney } from "../data/money";
import { getRegistryAnalytics, getRegistryHealth, listQualityFlags, resolveFlag, runScan, type RegistryHealth } from "../services/insights";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  bars: { padding: "8px 4px" },
  bar: { display: "flex", alignItems: "center", gap: "14px", padding: "10px 16px" },
  barLabel: { width: "130px", flexShrink: 0, fontSize: "13px", color: colors.ink2 },
  track: { flex: 1, height: "10px", borderRadius: "999px", backgroundColor: colors.bgSunken, overflow: "hidden" },
  fill: (pct: number) => ({ height: "100%", borderRadius: "999px", backgroundColor: colors.accent, width: `${pct}%` }),
  spacer24: { height: "24px" },
  pct: { width: "44px", textAlign: "right", fontSize: "13px", fontWeight: 600, color: colors.ink, fontVariantNumeric: "tabular-nums" },
  scanRow: { display: "flex", alignItems: "center", gap: "10px" },
  btn: { padding: "7px 13px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 18px", borderBottom: `1px solid ${colors.line}` },
  grow: { flex: 1, minWidth: 0 },
  flagTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  flagMeta: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  link: { padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" },
  kpi: { padding: "16px 18px", borderRadius: radius.lg, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev },
  kpiN: { fontSize: "28px", fontWeight: 700, color: colors.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" },
  kpiL: { fontSize: "12px", color: colors.ink3, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "20px", alignItems: "start" },
  cardMb: { marginBottom: "20px" },
  trendNote: { fontSize: "11.5px", color: colors.ink3 },
  chart: { display: "flex", alignItems: "flex-end", gap: "8px", height: "150px", padding: "20px 20px 0" },
  barWrap: { flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", minWidth: 0 },
  spendBar: (pct: number) => ({ width: "62%", maxWidth: "30px", height: `${pct}%`, minHeight: "2px", backgroundColor: colors.accent, borderRadius: "4px 4px 0 0" }),
  xaxis: { display: "flex", gap: "8px", padding: "8px 20px 18px" },
  xlabel: { flex: 1, textAlign: "center", fontSize: "10.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums", minWidth: 0, overflow: "hidden" },
  stack: { display: "flex", height: "14px", borderRadius: "7px", overflow: "hidden", margin: "4px 18px 16px" },
  seg: (pct: number, bg: string) => ({ height: "100%", width: `${pct}%`, backgroundColor: bg }),
  legendRow: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 18px", fontSize: "13px" },
  swatch: (bg: string) => ({ width: "10px", height: "10px", borderRadius: "3px", flexShrink: 0, backgroundColor: bg }),
  catName: { color: colors.ink2 },
  catPct: { width: "42px", textAlign: "right", fontSize: "12px", color: colors.ink3 },
  catVal: { minWidth: "84px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: colors.ink },
});

// category-segment palette (ported from the prototype's spend-by-category colours)
const PALETTE = ["#4F46E5", "#A855F7", "#F97316", "#0EA5E9", "#15803D", "#B45309", "#475569", "#DB2777"];

const sevTone = (s: string): "default" | "warn" | "danger" => (s === "high" ? "danger" : s === "medium" ? "warn" : "default");
const kindLabel = (k: string) => k.replace(/_/g, " ");

const BARS: [string, (h: RegistryHealth) => number][] = [
  ["Photographed", (h) => h.photographedPct],
  ["Categorised", (h) => h.categorisedPct],
  ["Located", (h) => h.locatedPct],
  ["Proof of value", (h) => h.proofPct],
];

/** F23/F29 — registry health + data-quality stream. Principal-private (the API hard-403s
  * Staff). Keeps the archive honest: what's incomplete, and one click to scan + resolve. */
export function Insights() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["insights", "health", token], queryFn: () => getRegistryHealth(token) });
  const analytics = useQuery({ queryKey: ["insights", "analytics", token], queryFn: () => getRegistryAnalytics(token) });
  const flags = useQuery({ queryKey: ["insights", "flags", token], queryFn: () => listQualityFlags(token) });
  const catTotal = analytics.data?.byCategory.reduce((s, c) => s + c.totalMinor, 0) ?? 0;

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["insights"] }); };
  const scan = useMutation({ mutationFn: () => runScan(token), onSuccess: invalidate });
  const resolve = useMutation({ mutationFn: (id: string) => resolveFlag(id, token), onSuccess: invalidate });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Insights · Registry health</div>
        <h1 {...stylex.props(styles.title)}>Insights</h1>
        <div {...stylex.props(styles.desc)}>How complete the archive is, and what's worth fixing — without the nagging.</div>
      </header>

      {analytics.data && (
        <div {...stylex.props(styles.kpis)} data-testid="insight-kpis">
          <div {...stylex.props(styles.kpi)}><div {...stylex.props(styles.kpiN)}>{analytics.data.assetTotal}</div><div {...stylex.props(styles.kpiL)}>Assets tracked</div></div>
          <div {...stylex.props(styles.kpi)}><div {...stylex.props(styles.kpiN)}>{fmtMoney(analytics.data.lifetimeSpendMinor, "GBP")}</div><div {...stylex.props(styles.kpiL)}>Lifetime spend</div></div>
          <div {...stylex.props(styles.kpi)}><div {...stylex.props(styles.kpiN)}>{analytics.data.byCategory.length}</div><div {...stylex.props(styles.kpiL)}>Categories</div></div>
        </div>
      )}

      <div {...stylex.props(styles.cols)}>
        <Card>
          <CardHeader><CardTitle>Value by category</CardTitle></CardHeader>
          {analytics.isPending ? <Loading /> : analytics.isError ? <ErrorState error={analytics.error} />
            : analytics.data.byCategory.length === 0 ? <EmptyState title="No costed assets" />
            : (
              <div data-testid="by-category">
                <div {...stylex.props(styles.stack)}>
                  {analytics.data.byCategory.map((c, i) => (
                    <span key={c.category} {...stylex.props(styles.seg(catTotal ? (c.totalMinor / catTotal) * 100 : 0, PALETTE[i % PALETTE.length]))} />
                  ))}
                </div>
                {analytics.data.byCategory.map((c, i) => (
                  <div key={c.category} {...stylex.props(styles.legendRow)} data-testid="cat-row">
                    <span {...stylex.props(styles.swatch(PALETTE[i % PALETTE.length]))} />
                    <span {...stylex.props(styles.grow, styles.catName)}>{c.category}</span>
                    <span {...stylex.props(styles.catPct)}>{catTotal ? Math.round((c.totalMinor / catTotal) * 100) : 0}%</span>
                    <span {...stylex.props(styles.catVal)}>{fmtMoney(c.totalMinor, "GBP")}</span>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Top assets by value</CardTitle></CardHeader>
          {analytics.isPending ? <Loading /> : analytics.isError ? <ErrorState error={analytics.error} />
            : analytics.data.topAssets.length === 0 ? <EmptyState title="No costed assets" />
            : analytics.data.topAssets.map((a) => (
              <div key={a.title} {...stylex.props(styles.row)} data-testid="top-asset">
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.flagTitle)}>{a.title}</div>
                  {a.maker && <div {...stylex.props(styles.flagMeta)}>{a.maker}</div>}
                </div>
                <span {...stylex.props(styles.catVal)}>{fmtMoney(a.valueMinor, "GBP")}</span>
              </div>
            ))}
        </Card>
      </div>

      {analytics.data && (() => {
        const gbp = analytics.data.spendByMonth.filter((p) => p.currency === "GBP");
        const max = Math.max(1, ...gbp.map((p) => p.totalMinor));
        const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });
        return (
          <Card style={styles.cardMb}>
            <CardHeader><CardTitle>Spend · last 12 months</CardTitle><span {...stylex.props(styles.trendNote)}>Approved expenses · GBP (native, no conversion)</span></CardHeader>
            {gbp.length === 0 ? <EmptyState title="No spend yet">Approved expenses will trend here by month.</EmptyState> : (
              <div data-testid="spend-trend">
                <div {...stylex.props(styles.chart)}>
                  {gbp.map((p) => (
                    <div key={p.month} {...stylex.props(styles.barWrap)} title={`${shortMonth(p.month)}: ${fmtMoney(p.totalMinor, "GBP")}`}>
                      <div {...stylex.props(styles.spendBar((p.totalMinor / max) * 100))} data-testid="spend-bar" />
                    </div>
                  ))}
                </div>
                <div {...stylex.props(styles.xaxis)}>
                  {gbp.map((p) => <span key={p.month} {...stylex.props(styles.xlabel)}>{shortMonth(p.month)}</span>)}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      <Card>
        <CardHeader><CardTitle>Registry health{health.data ? ` · ${health.data.total} assets` : ""}</CardTitle></CardHeader>
        {health.isPending ? <Loading /> : health.isError ? <ErrorState error={health.error} /> : (
          <div {...stylex.props(styles.bars)} data-testid="registry-health">
            {BARS.map(([label, get]) => {
              const v = get(health.data);
              return (
                <div key={label} {...stylex.props(styles.bar)} data-testid="health-bar">
                  <span {...stylex.props(styles.barLabel)}>{label}</span>
                  <span {...stylex.props(styles.track)}><span {...stylex.props(styles.fill(v))} /></span>
                  <span {...stylex.props(styles.pct)}>{v}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div {...stylex.props(styles.spacer24)} />

      <Card>
        <CardHeader>
          <CardTitle>Data quality{flags.data ? ` · ${flags.data.length} open` : ""}</CardTitle>
          <div {...stylex.props(styles.scanRow)}>
            <button type="button" {...stylex.props(styles.btn)} onClick={() => scan.mutate()} disabled={scan.isPending}>
              {scan.isPending ? "Scanning…" : "Run scan"}
            </button>
          </div>
        </CardHeader>
        {flags.isPending ? <Loading /> : flags.isError ? <ErrorState error={flags.error} />
          : flags.data.length === 0 ? <EmptyState title="Nothing flagged">Run a scan to check the registry for gaps.</EmptyState>
          : flags.data.map((f) => (
            <div key={f.id} {...stylex.props(styles.row)} data-testid="flag-row">
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.flagTitle)}>{kindLabel(f.kind)}</div>
                <div {...stylex.props(styles.flagMeta)}>{f.assetTitle ?? "—"}</div>
              </div>
              <Pill tone={sevTone(f.severity)}>{f.severity}</Pill>
              <button type="button" {...stylex.props(styles.link)} onClick={() => resolve.mutate(f.id)}>Resolve</button>
            </div>
          ))}
      </Card>
    </div>
  );
}

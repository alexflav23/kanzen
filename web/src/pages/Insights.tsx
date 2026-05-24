import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { getRegistryHealth, listQualityFlags, resolveFlag, runScan, type RegistryHealth } from "../services/insights";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  bars: { padding: "8px 4px" },
  bar: { display: "flex", alignItems: "center", gap: "14px", padding: "10px 16px" },
  barLabel: { width: "130px", flexShrink: 0, fontSize: "13px", color: colors.ink2 },
  track: { flex: 1, height: "10px", borderRadius: "999px", backgroundColor: colors.bgSunken, overflow: "hidden" },
  fill: { height: "100%", borderRadius: "999px", backgroundColor: colors.accent },
  pct: { width: "44px", textAlign: "right", fontSize: "13px", fontWeight: 600, color: colors.ink, fontVariantNumeric: "tabular-nums" },
  scanRow: { display: "flex", alignItems: "center", gap: "10px" },
  btn: { padding: "7px 13px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 18px", borderBottom: `1px solid ${colors.line}` },
  grow: { flex: 1, minWidth: 0 },
  flagTitle: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  flagMeta: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  link: { padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
});

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
  const flags = useQuery({ queryKey: ["insights", "flags", token], queryFn: () => listQualityFlags(token) });

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

      <Card>
        <CardHeader><CardTitle>Registry health{health.data ? ` · ${health.data.total} assets` : ""}</CardTitle></CardHeader>
        {health.isPending ? <Loading /> : health.isError ? <ErrorState error={health.error} /> : (
          <div {...stylex.props(styles.bars)} data-testid="registry-health">
            {BARS.map(([label, get]) => {
              const v = get(health.data);
              return (
                <div key={label} {...stylex.props(styles.bar)} data-testid="health-bar">
                  <span {...stylex.props(styles.barLabel)}>{label}</span>
                  <span {...stylex.props(styles.track)}><span {...stylex.props(styles.fill)} style={{ width: `${v}%` }} /></span>
                  <span {...stylex.props(styles.pct)}>{v}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ height: "24px" }} />

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

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { ErrorState } from "../components/states";
import { useAuth } from "../state/AuthContext";
import { restoreDryRun, runExport, validateArchive, type Archive, type ExportResult, type RestoreResult, type ValidateResult } from "../services/backup";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  actions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  btn: { padding: "9px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13.5px", color: colors.ink },
  primary: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  table: { width: "100%", borderCollapse: "collapse" },
  td: { padding: "10px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  note: { padding: "14px 18px", fontSize: "13px", color: colors.ink3 },
  err: { padding: "10px 18px", fontSize: "13px", color: colors.danger },
  gap: { height: "20px" },
});

/** F30 — backup/export/restore. Principal-only (the API hard-403s anyone else). Run a full
  * export → self-descriptive manifest; validate its checksums; dry-run a restore (writes
  * nothing). `apply`-ing a full restore + age encryption + S3 streaming are operator-gated. */
export function Backup() {
  const { token } = useAuth();
  const [archive, setArchive] = useState<Archive | null>(null);

  const exp = useMutation<ExportResult>({ mutationFn: () => runExport(token), onSuccess: (r) => setArchive(r.archive) });
  const val = useMutation<ValidateResult>({ mutationFn: () => validateArchive(token, archive!) });
  const dry = useMutation<RestoreResult>({ mutationFn: () => restoreDryRun(token, archive!) });

  const counts = exp.data ? Object.entries(exp.data.manifest.object_counts) : [];
  const checksums = exp.data ? Object.keys(exp.data.manifest.section_checksums).length : 0;

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Finance &amp; System · Backup</div>
        <h1 {...stylex.props(styles.title)}>Backup &amp; restore</h1>
        <div {...stylex.props(styles.desc)}>Take the whole estate as one verifiable archive, restorable into a fresh install. Validate checksums; dry-run a restore before any write.</div>
      </header>

      <Card>
        <CardHeader><CardTitle>Full export</CardTitle></CardHeader>
        <div {...stylex.props(styles.note, styles.actions)}>
          <button type="button" {...stylex.props(styles.btn, styles.primary)} onClick={() => exp.mutate()} disabled={exp.isPending} data-testid="run-export">
            {exp.isPending ? "Exporting…" : "Run full export"}
          </button>
          {archive && <button type="button" {...stylex.props(styles.btn)} onClick={() => val.mutate()} disabled={val.isPending} data-testid="validate">Validate</button>}
          {archive && <button type="button" {...stylex.props(styles.btn)} onClick={() => dry.mutate()} disabled={dry.isPending} data-testid="dry-run">Restore (dry-run)</button>}
        </div>
        {exp.isError && <ErrorState error={exp.error} />}
        {exp.data && (
          <div data-testid="export-result">
            <div {...stylex.props(styles.note)}>
              Manifest v{exp.data.manifest.export_version} · schema {exp.data.manifest.schema_version} · {checksums} section checksums
            </div>
            <table {...stylex.props(styles.table)} data-testid="manifest-counts">
              <tbody>
                {counts.map(([section, n]) => (
                  <tr key={section}>
                    <td {...stylex.props(styles.td)}>{section}</td>
                    <td {...stylex.props(styles.td, styles.tdR)}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {val.data && (
        <>
          <div {...stylex.props(styles.gap)} />
          <Card>
            <CardHeader><CardTitle>Validation</CardTitle>{val.data.valid ? <Pill>valid</Pill> : <Pill tone="danger">invalid</Pill>}</CardHeader>
            <div {...stylex.props(styles.note)} data-testid="validate-result">
              {val.data.valid ? "All checksums verified; schema compatible." : ""}
            </div>
            {val.data.errors.map((e) => <div key={e} {...stylex.props(styles.err)}>{e}</div>)}
          </Card>
        </>
      )}

      {dry.data && (
        <>
          <div {...stylex.props(styles.gap)} />
          <Card>
            <CardHeader><CardTitle>Restore dry-run</CardTitle><Pill tone="warn">nothing written</Pill></CardHeader>
            <table {...stylex.props(styles.table)} data-testid="dryrun-result">
              <tbody>
                {Object.entries(dry.data.wouldApply).map(([section, n]) => (
                  <tr key={section}><td {...stylex.props(styles.td)}>{section}</td><td {...stylex.props(styles.td, styles.tdR)}>{n} rows</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

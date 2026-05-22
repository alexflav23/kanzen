// Backup — first-class export, manifest, restore, snapshots
function BackupView() {
  const I = window.I;
  const b = window.INVENTORY.backup;
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  function runExport() {
    setRunning(true);
    setProgress(0);
    const t = setInterval(() => {
      setProgress(p => {
        const n = Math.min(100, p + Math.random() * 14 + 4);
        if (n >= 100) {
          clearInterval(t);
          setTimeout(() => setRunning(false), 600);
        }
        return n;
      });
    }, 250);
  }

  return (
    <div className="page fade-in" style={{ maxWidth: 1240, padding: "32px 32px 80px" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Catastrophic-loss recovery</div>
          <div className="t-title">Backup</div>
          <div className="muted t-body" style={{ marginTop: 6, maxWidth: 620 }}>
            The full system — domain data, documents, ledger postings, audit trail — exported as a self-descriptive, portable archive. Restorable into a fresh installation without the original codebase.
          </div>
        </div>
        <button className="btn btn-accent" onClick={runExport} disabled={running}>
          <I.Download size={14}/>
          {running ? `Exporting · ${Math.round(progress)}%` : "Run full export"}
        </button>
      </header>

      {running && (
        <div className="card card-pad" style={{ marginBottom: 24 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="t-small" style={{ fontWeight: 600, color: "var(--ink)" }}>Export in progress</span>
            <span className="spacer"></span>
            <span className="t-small num">{Math.round(progress)}%</span>
          </div>
          <div className="bar"><i style={{ width: progress + "%" }}/></div>
          <div className="t-small" style={{ marginTop: 8 }}>
            {progress < 30 && "Snapshotting domain tables…"}
            {progress >= 30 && progress < 60 && "Streaming documents from S3…"}
            {progress >= 60 && progress < 85 && "Including ledger posting history…"}
            {progress >= 85 && "Building manifest + checksums…"}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
        {/* Status */}
        <div className="card card-pad-lg">
          <div className="row" style={{ marginBottom: 18 }}>
            <I.Shield size={18} style={{ color: "var(--positive)" }}/>
            <span className="t-h2">Last full export</span>
          </div>
          <dl className="meta-grid" style={{ gridTemplateColumns: "150px 1fr" }}>
            <dt>Status</dt><dd><span className="pill pill-positive"><I.Check size={11}/>{b.lastFullStatus}</span></dd>
            <dt>Created</dt><dd>{window.fmtDate(b.lastFull)} · 03:00 UTC</dd>
            <dt>Size</dt><dd>{b.lastFullSizeMB} MB · gzipped</dd>
            <dt>Encryption</dt><dd>{b.encryption.enabled ? `Enabled · ${b.encryption.algorithm}` : "None"}</dd>
            <dt>Next scheduled</dt><dd>{window.fmtDate(b.nextScheduled)} · {b.autoFrequency}</dd>
          </dl>
          <div className="row" style={{ marginTop: 22, gap: 8 }}>
            <button className="btn"><I.Download size={13}/>Download archive</button>
            <button className="btn"><I.Eye size={13}/>View manifest</button>
            <button className="btn"><I.Refresh size={13}/>Restore dry-run</button>
          </div>
        </div>

        {/* Annual snapshots */}
        <div className="card card-pad-lg">
          <div className="row" style={{ marginBottom: 18 }}>
            <I.Database size={18}/>
            <span className="t-h2">Annual immutable snapshots</span>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {b.annualSnapshots.map(s => (
              <div key={s.year} className="row" style={{ padding: "12px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)" }}>
                <div style={{ width: 50, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em" }}>{s.year}</div>
                </div>
                <div style={{ flex: 1, paddingLeft: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Created {window.fmtDate(s.at)}</div>
                  <div className="muted t-small">{s.sizeMB} MB<span className="dot-sep"></span>{s.integrity}<span className="dot-sep"></span>read-only</div>
                </div>
                <span className="pill"><I.Lock size={11}/>Immutable</span>
                <button className="icon-btn"><I.Download size={14}/></button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 4, justifyContent: "flex-start", color: "var(--ink-3)" }}>
              <I.Plus size={13}/>Create snapshot now
            </button>
          </div>
        </div>

        {/* Manifest preview */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-header">
            <span className="card-title">Export manifest · preview</span>
            <span className="t-small">Bundled with every archive · format v1.0</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ padding: "20px 24px", borderRight: "1px solid var(--line)" }}>
              <div className="t-eyebrow" style={{ marginBottom: 12 }}>Entity counts</div>
              <div className="col" style={{ gap: 10 }}>
                {Object.entries(b.entityCounts).map(([k, v]) => (
                  <div key={k} className="row">
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }} className="t-mono">{k}</span>
                    <span className="spacer"></span>
                    <span className="num" style={{ fontWeight: 500, fontSize: 13 }}>{v.toLocaleString()}</span>
                  </div>
                ))}
                <div className="row">
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }} className="t-mono">audit_log_entries</span>
                  <span className="spacer"></span>
                  <span className="num" style={{ fontWeight: 500, fontSize: 13 }}>184,201</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div className="t-eyebrow" style={{ marginBottom: 12 }}>manifest.json</div>
              <pre style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.55,
                color: "var(--ink-2)",
                background: "var(--bg-sunken)",
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                overflow: "auto",
                maxHeight: 280,
              }}>{`{
  "export_version": "1.0.0",
  "application_version": "0.1.0",
  "schema_version": "2026-01",
  "export_timestamp": "${b.lastFull}",
  "owner_id": "usr_principal_001",
  "object_counts": {
    "assets": ${b.entityCounts.assets},
    "documents": ${b.entityCounts.documents},
    "bank_transactions": ${b.entityCounts.bank_transactions}
  },
  "checksum_algorithm": "sha256",
  "encryption_status": {
    "enabled": true,
    "algorithm": "age"
  }
}`}</pre>
            </div>
          </div>
        </div>

        <div className="card card-pad-lg" style={{ gridColumn: "1 / -1" }}>
          <div className="row" style={{ marginBottom: 14 }}>
            <I.Sparkles size={16} style={{ color: "var(--accent)" }}/>
            <span className="t-h2">Restore from a backup</span>
          </div>
          <div className="muted t-body" style={{ marginBottom: 18 }}>
            Restores entities in safe dependency order, validates manifest checksums and schema compatibility, and supports a dry-run before any real restore. Use after catastrophic loss, when migrating to a new environment, or when validating an annual snapshot's integrity.
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn"><I.Download size={13}/>Upload archive</button>
            <button className="btn">Run dry-run</button>
            <button className="btn btn-danger" style={{ marginLeft: "auto" }}><I.Refresh size={13}/>Restore from latest</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BackupView = BackupView;

import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Search, Shield } from "../components/icons";
import { fileToBase64, listDocuments, uploadDocument } from "../services/documents";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const CATEGORIES = ["receipt", "invoice", "warranty", "appraisal", "statement", "insurance", "service", "legal", "other"];

const styles = stylex.create({
  page: { maxWidth: "1200px" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  toolbar: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, marginBottom: "16px" },
  input: { border: 0, background: "transparent", padding: 0, fontSize: "14px", height: "28px", flex: 1, color: colors.ink, outline: "none" },
  segs: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" },
  seg: { padding: "5px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, background: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2, textTransform: "capitalize" },
  segActive: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  name: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 },
  lock: { display: "inline-flex", color: colors.ink3 },
  sub: { fontSize: "12px", color: colors.ink3 },
  hidden: { display: "none" },
  err: { fontSize: "12.5px", color: colors.danger, marginBottom: "12px" },
});

function fmtSize(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Documents() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const docsQ = useQuery({ queryKey: ["documents", category, search, token], queryFn: () => listDocuments(token, category, search) });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await fileToBase64(file);
      return uploadDocument(
        { name: file.name, category: category ?? "other", contentType: file.type || "application/octet-stream", contentBase64 },
        token,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Evidence store · immutable originals</div>
          <h1 {...stylex.props(styles.title)}>Documents</h1>
          <div {...stylex.props(styles.desc)}>Receipts, invoices, warranties, appraisals — originals are sacred and never edited.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} onClick={() => fileRef.current?.click()}>
          <Plus size={14} /> Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          data-testid="doc-file"
          aria-label="Upload document"
          {...stylex.props(styles.hidden)}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }}
        />
      </header>

      <div {...stylex.props(styles.toolbar)}>
        <Search size={15} />
        <input {...stylex.props(styles.input)} placeholder="Search documents by name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
      </div>

      <div {...stylex.props(styles.segs)}>
        <button type="button" onClick={() => setCategory(null)} {...stylex.props(styles.seg, category === null && styles.segActive)}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} {...stylex.props(styles.seg, category === c && styles.segActive)}>{c}</button>
        ))}
      </div>

      {upload.isError && <div {...stylex.props(styles.err)} role="alert">Upload failed — try again.</div>}

      {docsQ.isPending ? <Loading label="Loading documents…" />
        : docsQ.isError ? <ErrorState error={docsQ.error} />
        : docsQ.data.length === 0 ? <EmptyState title="No documents">Upload a receipt, invoice or warranty to start the evidence store.</EmptyState>
        : (
          <Card>
            <table {...stylex.props(styles.table)}>
              <thead><tr>
                <th {...stylex.props(styles.th)}>Document</th><th {...stylex.props(styles.th)}>Category</th>
                <th {...stylex.props(styles.th)}>Source</th><th {...stylex.props(styles.th)}>Size</th>
              </tr></thead>
              <tbody>
                {docsQ.data.map((d) => (
                  <tr key={d.id} data-testid="doc-row">
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.name)}>
                        {d.immutable && <span {...stylex.props(styles.lock)} title="Immutable original"><Shield size={13} /></span>}
                        {d.name}
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}><Pill>{d.category}</Pill></td>
                    <td {...stylex.props(styles.td)}>{d.source === "agent" ? <Pill tone="accent">agent</Pill> : "manual"}</td>
                    <td {...stylex.props(styles.td)}>{fmtSize(d.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
    </div>
  );
}

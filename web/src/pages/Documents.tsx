import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Search, Shield, Documents as DocIcon, Image as ImageIcon, X, External, ChevronLeft, ChevronRight } from "../components/icons";
import { documentDownloadUrl, fileToBase64, listDocuments, uploadDocument, type Document } from "../services/documents";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const CATEGORIES = ["receipt", "invoice", "warranty", "appraisal", "statement", "insurance", "service", "legal", "other"];
const isImage = (ct: string | null) => !!ct && ct.startsWith("image/");
const isPdf = (ct: string | null) => ct === "application/pdf";

const styles = stylex.create({
  page: { maxWidth: "1200px", position: "relative" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "620px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", flexShrink: 0 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" },
  kpi: { padding: "16px 18px" },
  kpiLabel: { fontSize: "11.5px", color: colors.ink3 },
  kpiVal: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.022em", marginTop: "4px", color: colors.ink, fontVariantNumeric: "tabular-nums" },
  kpiSub: { fontSize: "11.5px", color: colors.ink3, marginTop: "4px" },
  toolbar: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, marginBottom: "16px" },
  input: { border: 0, background: "transparent", padding: 0, fontSize: "14px", height: "28px", flex: 1, color: colors.ink, outline: "none" },
  viewToggle: { display: "inline-flex", borderRadius: radius.sm, border: `1px solid ${colors.line}`, overflow: "hidden", flexShrink: 0 },
  viewBtn: { padding: "5px 12px", border: 0, borderLeft: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink3, cursor: "pointer", fontSize: "12.5px" },
  viewBtnFirst: { borderLeft: 0 },
  viewBtnOn: { backgroundColor: colors.accent, color: colors.accentInk },
  // grid view
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))", gap: "14px" },
  gcard: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, overflow: "hidden", cursor: "pointer", color: colors.ink, textAlign: "left", padding: 0, display: "flex", flexDirection: "column", ":hover": { boxShadow: colors.shadow1 } },
  gthumb: { aspectRatio: "4 / 3", backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", color: colors.ink4, position: "relative" },
  gthumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  gext: { position: "absolute", bottom: "6px", right: "8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: colors.ink3, textTransform: "uppercase" },
  gbody: { padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  gname: { fontSize: "13px", fontWeight: 500, color: colors.ink, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 },
  gnameText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  gmeta: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: colors.ink3 },
  gmetaGrow: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" },
  pager: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "16px" },
  pagerInfo: { fontSize: "12.5px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  pagerBtn: { display: "inline-grid", placeItems: "center", width: "30px", height: "30px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", ":disabled": { opacity: 0.4, cursor: "default" } },
  segs: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" },
  seg: { padding: "5px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2, textTransform: "capitalize" },
  segActive: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  row: { cursor: "pointer", ":hover": { backgroundColor: colors.bgSunken } },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  tdIcon: { padding: "12px 0 12px 16px", width: "26px", color: colors.ink3 },
  name: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 },
  lock: { display: "inline-flex", color: colors.ink3 },
  hidden: { display: "none" },
  err: { fontSize: "12.5px", color: colors.danger, marginBottom: "12px" },
  // drag-drop
  dropOverlay: { position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", backgroundColor: colors.scrim, pointerEvents: "none" },
  dropCard: { padding: "26px 40px", borderRadius: radius.lg, border: `2px dashed ${colors.accent}`, backgroundColor: colors.bgElev, color: colors.accent, fontSize: "15px", fontWeight: 600 },
  // preview modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 50, padding: "32px" },
  modal: { width: "min(860px, 92vw)", height: "min(80vh, 800px)", display: "flex", flexDirection: "column", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, overflow: "hidden" },
  mHead: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  mName: { fontWeight: 600, fontSize: "14px", color: colors.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  mAction: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", textDecoration: "none" },
  iconBtn: { width: "30px", height: "30px", display: "grid", placeItems: "center", borderRadius: "8px", border: 0, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", flexShrink: 0 },
  mBody: { flex: 1, minHeight: 0, backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", overflow: "auto" },
  frame: { width: "100%", height: "100%", border: 0, backgroundColor: "#fff" },
  previewImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  fallback: { color: colors.ink3, fontSize: "13px", textAlign: "center", padding: "24px" },
});

const fmtSize = (n: number | null): string => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const totalSize = (docs: Document[]) => docs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0);

/** Preview an immutable original in-app: PDF → iframe, image → img, anything else → open/download link. */
function DocPreview({ doc, token, onClose }: { doc: Document; token: string | null; onClose: () => void }) {
  const urlQ = useQuery({ queryKey: ["doc-url", doc.id, token], queryFn: () => documentDownloadUrl(doc.id, token) });
  const url = urlQ.data?.url;
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" aria-label={`Preview ${doc.name}`} onClick={onClose}>
      <div {...stylex.props(styles.modal)} data-testid="doc-preview" onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.mHead)}>
          <span {...stylex.props(styles.mName)}>{doc.name}</span>
          {url && <a {...stylex.props(styles.mAction)} href={url} target="_blank" rel="noreferrer">Open <External size={11} /></a>}
          <button type="button" {...stylex.props(styles.iconBtn)} aria-label="Close preview" onClick={onClose}><X size={16} /></button>
        </div>
        <div {...stylex.props(styles.mBody)}>
          {urlQ.isPending ? <Loading />
            : urlQ.isError || !url ? <div {...stylex.props(styles.fallback)}>Couldn't load this document.</div>
            : isImage(doc.contentType) ? <img {...stylex.props(styles.previewImg)} src={url} alt={doc.name} />
            : isPdf(doc.contentType) ? <iframe {...stylex.props(styles.frame)} src={url} title={doc.name} data-testid="pdf-frame" />
            : <div {...stylex.props(styles.fallback)}>No inline preview for this file type.<br /><a {...stylex.props(styles.mAction)} href={url} target="_blank" rel="noreferrer">Download <External size={11} /></a></div>}
        </div>
      </div>
    </div>
  );
}

export function Documents() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [preview, setPreview] = useState<Document | null>(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setPage(0), [category, search, view]); // reset paging when the view changes

  const docsQ = useQuery({ queryKey: ["documents", category, search, token], queryFn: () => listDocuments(token, category, search) });
  // KPI tiles reflect the whole store, independent of the active filter/search.
  const allQ = useQuery({ queryKey: ["documents", "all", token], queryFn: () => listDocuments(token, null, null) });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await fileToBase64(file);
      return uploadDocument({ name: file.name, category: category ?? "other", contentType: file.type || "application/octet-stream", contentBase64 }, token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const uploadFiles = (files: FileList | null) => { if (files) for (const f of Array.from(files)) upload.mutate(f); };

  const all = allQ.data ?? [];
  const kpis = [
    { label: "Total documents", val: all.length.toLocaleString(), sub: "immutable originals" },
    { label: "Storage used", val: fmtSize(totalSize(all)), sub: "S3 · eu-west-1" },
    { label: "Immutable originals", val: all.filter((d) => d.immutable).length.toLocaleString(), sub: "write-once, never edited" },
    { label: "Agent-filed", val: all.filter((d) => d.source === "agent").length.toLocaleString(), sub: "the agent files to S3" },
  ];

  return (
    <div {...stylex.props(styles.page)}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}>
      {dragging && <div {...stylex.props(styles.dropOverlay)}><div {...stylex.props(styles.dropCard)}>Drop to upload</div></div>}

      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Evidence store · immutable originals</div>
          <h1 {...stylex.props(styles.title)}>Documents</h1>
          <div {...stylex.props(styles.desc)}>Originals are immutable; the agent files them to S3. Drag a PDF, photo or scan anywhere on this page to upload.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} onClick={() => fileRef.current?.click()}><Plus size={14} /> Upload</button>
        <input ref={fileRef} type="file" multiple accept="application/pdf,image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" data-testid="doc-file" aria-label="Upload document" {...stylex.props(styles.hidden)}
          onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
      </header>

      <div {...stylex.props(styles.kpis)}>
        {kpis.map((k) => (
          <Card key={k.label} style={styles.kpi}>
            <div {...stylex.props(styles.kpiLabel)}>{k.label}</div>
            <div {...stylex.props(styles.kpiVal)} data-testid="doc-kpi">{k.val}</div>
            <div {...stylex.props(styles.kpiSub)}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div {...stylex.props(styles.toolbar)}>
        <Search size={15} />
        <input {...stylex.props(styles.input)} placeholder="Search documents by name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
        <div {...stylex.props(styles.viewToggle)} role="group" aria-label="View">
          <button type="button" {...stylex.props(styles.viewBtn, styles.viewBtnFirst, view === "grid" && styles.viewBtnOn)} aria-pressed={view === "grid"} onClick={() => setView("grid")}>Grid</button>
          <button type="button" {...stylex.props(styles.viewBtn, view === "list" && styles.viewBtnOn)} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
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
        : docsQ.data.length === 0 ? <EmptyState title="No documents">Drag a PDF or scan here, or hit Upload, to start the evidence store.</EmptyState>
        : (() => {
            const docs = docsQ.data;
            const SIZE = view === "grid" ? 12 : 15;
            const pages = Math.max(1, Math.ceil(docs.length / SIZE));
            const cur = Math.min(page, pages - 1);
            const shown = docs.slice(cur * SIZE, cur * SIZE + SIZE);
            return (
              <>
                {view === "grid" ? (
                  <div {...stylex.props(styles.grid)} data-testid="doc-grid">
                    {shown.map((d) => (
                      <button key={d.id} type="button" data-testid="doc-card" {...stylex.props(styles.gcard)} onClick={() => setPreview(d)}>
                        <span {...stylex.props(styles.gthumb)}>
                          {isImage(d.contentType) ? <ImageIcon size={28} /> : <DocIcon size={28} />}
                          <span {...stylex.props(styles.gext)}>{d.name.split(".").pop()?.slice(0, 4) ?? "file"}</span>
                        </span>
                        <span {...stylex.props(styles.gbody)}>
                          <span {...stylex.props(styles.gname)}>
                            {d.immutable && <span {...stylex.props(styles.lock)} title="Immutable original"><Shield size={12} /></span>}
                            <span {...stylex.props(styles.gnameText)}>{d.name}</span>
                          </span>
                          <span {...stylex.props(styles.gmeta)}>
                            <Pill tone={d.source === "agent" ? "accent" : "default"}>{d.category}</Pill>
                            <span {...stylex.props(styles.gmetaGrow)}>{fmtSize(d.sizeBytes)}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <table {...stylex.props(styles.table)}>
                      <thead><tr>
                        <th {...stylex.props(styles.th)} aria-label="Type" /><th {...stylex.props(styles.th)}>Document</th>
                        <th {...stylex.props(styles.th)}>Category</th><th {...stylex.props(styles.th)}>Source</th>
                        <th {...stylex.props(styles.th)}>Size</th><th {...stylex.props(styles.th)}>Uploaded</th>
                      </tr></thead>
                      <tbody>
                        {shown.map((d) => (
                          <tr key={d.id} data-testid="doc-row" {...stylex.props(styles.row)} onClick={() => setPreview(d)}>
                            <td {...stylex.props(styles.tdIcon)}>{isImage(d.contentType) ? <ImageIcon size={15} /> : <DocIcon size={15} />}</td>
                            <td {...stylex.props(styles.td)}>
                              <span {...stylex.props(styles.name)}>
                                {d.immutable && <span {...stylex.props(styles.lock)} title="Immutable original"><Shield size={13} /></span>}
                                {d.name}
                              </span>
                            </td>
                            <td {...stylex.props(styles.td)}><Pill>{d.category}</Pill></td>
                            <td {...stylex.props(styles.td)}>{d.source === "agent" ? <Pill tone="accent">agent</Pill> : "manual"}</td>
                            <td {...stylex.props(styles.td)}>{fmtSize(d.sizeBytes)}</td>
                            <td {...stylex.props(styles.td)}>{fmtDate(d.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
                {pages > 1 && (
                  <div {...stylex.props(styles.pager)}>
                    <span {...stylex.props(styles.pagerInfo)} data-testid="doc-pageinfo">{cur * SIZE + 1}–{Math.min(docs.length, cur * SIZE + SIZE)} of {docs.length}</span>
                    <button type="button" {...stylex.props(styles.pagerBtn)} aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft size={15} /></button>
                    <button type="button" {...stylex.props(styles.pagerBtn)} aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight size={15} /></button>
                  </div>
                )}
              </>
            );
          })()}

      {preview && <DocPreview doc={preview} token={token} onClose={() => setPreview(null)} />}
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { createVendor, listVendors } from "../services/vendors";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

function insuranceStatus(iso: string | null): { label: string; expired: boolean } | null {
  if (!iso) return null;
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  return days < 0 ? { label: "Insurance expired", expired: true } : { label: `Insured · ${days}d`, expired: false };
}

const styles = stylex.create({
  page: { maxWidth: "1100px" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  bold: { fontWeight: 500 },
  cap: { textTransform: "capitalize" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

function NewVendorModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const mutation = useMutation({
    mutationFn: () => createVendor({ name, type: "business", trade: trade || null, ndaUntil: null, insuranceUntil: null, rating: null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-vendor" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New vendor</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thames Plumbing" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Trade</span>
          <input {...stylex.props(styles.control)} aria-label="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. plumber" /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? "Adding…" : "Add vendor"}</button>
        </div>
      </form>
    </div>
  );
}

export function Vendors() {
  const { token } = useAuth();
  const [adding, setAdding] = useState(false);
  const vendorsQ = useQuery({ queryKey: ["vendors", token], queryFn: () => listVendors(token) });

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Records · property-scoped</div>
          <h1 {...stylex.props(styles.title)}>Vendors</h1>
          <div {...stylex.props(styles.desc)}>The approved-supplier directory. A vendor is assignable only while its insurance is current.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} onClick={() => setAdding(true)}><Plus size={14} /> New vendor</button>
      </header>

      {adding && <NewVendorModal token={token} onClose={() => setAdding(false)} />}

      {vendorsQ.isPending ? <Loading label="Loading vendors…" />
        : vendorsQ.isError ? <ErrorState error={vendorsQ.error} />
        : vendorsQ.data.length === 0 ? <EmptyState title="No vendors yet">Add an approved supplier to start the directory.</EmptyState>
        : (
          <Card>
            <table {...stylex.props(styles.table)}>
              <thead><tr>
                <th {...stylex.props(styles.th)}>Vendor</th><th {...stylex.props(styles.th)}>Trade</th>
                <th {...stylex.props(styles.th)}>Type</th><th {...stylex.props(styles.th)}>Insurance</th>
              </tr></thead>
              <tbody>
                {vendorsQ.data.map((v) => {
                  const ins = insuranceStatus(v.insuranceUntil);
                  return (
                    <tr key={v.id} data-testid="vendor-row">
                      <td {...stylex.props(styles.td, styles.bold)}>{v.name}</td>
                      <td {...stylex.props(styles.td, styles.cap)}>{v.trade ?? "—"}</td>
                      <td {...stylex.props(styles.td, styles.cap)}>{v.type}</td>
                      <td {...stylex.props(styles.td)}>{ins ? <Pill tone={ins.expired ? "danger" : "default"}>{ins.label}</Pill> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
    </div>
  );
}

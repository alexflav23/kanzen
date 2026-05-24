import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus } from "../components/icons";
import { createProperty, listProperties, type Property } from "../services/properties";
import { ApiError } from "../services/http";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

// Deterministic cover so each property reads consistently (rich imagery lands with F05).
const COVERS = ["linear-gradient(135deg,#1B1F2E,#3B3F55)", "linear-gradient(135deg,#243B47,#3D6B7D)"];

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "28px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" },
  card: { border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, overflow: "hidden", padding: 0, textAlign: "left", cursor: "pointer", color: colors.ink },
  cover: { height: "180px", position: "relative", color: "#fff" },
  coverTop: { position: "absolute", top: "16px", left: "18px", right: "18px", display: "flex", justifyContent: "space-between" },
  coverBottom: { position: "absolute", bottom: "18px", left: "20px", right: "20px" },
  coverName: { fontSize: "24px", fontWeight: 600, letterSpacing: "-0.018em" },
  outlinePill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: radius.sm, fontSize: "12px", color: "#fff", backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", textTransform: "capitalize" },
  stats: { padding: "18px 22px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" },
  statL: { fontSize: "11px", color: colors.ink3 },
  statN: { fontSize: "18px", fontWeight: 600, letterSpacing: "-0.014em", marginTop: "2px", fontVariantNumeric: "tabular-nums" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  input: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  err: { fontSize: "12.5px", color: colors.danger, marginTop: "10px" },
});

function PropertyCard({ p, cover, onOpen }: { p: Property; cover: string; onOpen: () => void }) {
  const stats: [string, string][] = [
    ["Currency", p.currency],
    ["Rooms", "—"],
    ["Assets", "—"],
    ["Vendors", "—"],
  ];
  return (
    <button type="button" data-testid="property-card" onClick={onOpen} {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cover)} style={{ background: cover }}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction ?? "—"}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.status}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}>
          <div {...stylex.props(styles.coverName)}>{p.name}</div>
        </div>
      </div>
      <div {...stylex.props(styles.stats)}>
        {stats.map(([l, v]) => (
          <div key={l}>
            <div {...stylex.props(styles.statL)}>{l}</div>
            <div {...stylex.props(styles.statN)}>{v}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

function AddPropertyModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("GB");
  const [currency, setCurrency] = useState("GBP");
  const mutation = useMutation({
    mutationFn: () =>
      createProperty({ name, address: null, jurisdiction, propType: "apartment", ownership: "owned", currency }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      onClose();
    },
  });

  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-property" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add property</div>
        <label {...stylex.props(styles.field)}>
          <span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.input)} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wardian — Apt 5206" autoFocus />
        </label>
        <label {...stylex.props(styles.field)}>
          <span {...stylex.props(styles.label)}>Jurisdiction</span>
          <input {...stylex.props(styles.input)} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
        </label>
        <label {...stylex.props(styles.field)}>
          <span {...stylex.props(styles.label)}>Default currency</span>
          <input {...stylex.props(styles.input)} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </label>
        {mutation.isError && (
          <div {...stylex.props(styles.err)} role="alert">
            {mutation.error instanceof ApiError ? mutation.error.detail : "Couldn't create the property."}
          </div>
        )}
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Adding…" : "Add property"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Properties() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [adding, setAdding] = useState(false);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["properties", token],
    queryFn: () => listProperties(token),
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>The Bibles</div>
          <h1 {...stylex.props(styles.title)}>Properties</h1>
          <div {...stylex.props(styles.desc)}>One record per property. The full picture: rooms, assets, systems, documents.</div>
        </div>
        <button type="button" onClick={() => setAdding(true)} {...stylex.props(styles.btn)}><Plus size={14} /> Add property</button>
      </header>
      {adding && <AddPropertyModal token={token} onClose={() => setAdding(false)} />}

      {isPending ? (
        <Loading label="Loading properties…" />
      ) : isError ? (
        <ErrorState error={error} />
      ) : data.length === 0 ? (
        <EmptyState title="No properties yet">Add your first property to start its record.</EmptyState>
      ) : (
        <div {...stylex.props(styles.grid)}>
          {data.map((p, i) => (
            <PropertyCard key={p.id} p={p} cover={COVERS[i % COVERS.length]} onOpen={() => navigate(`/properties/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

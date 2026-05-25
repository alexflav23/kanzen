import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Box, ChevronRight } from "../components/icons";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { createCollection, getMembers, listCollections } from "../services/collections";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", gap: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "620px" },
  grow: { flex: 1, minWidth: 0 },
  cname: { fontSize: "15px", fontWeight: 600, color: colors.ink },
  cdesc: { fontSize: "12.5px", color: colors.ink3, marginTop: "2px" },
  icon: { width: "36px", height: "36px", borderRadius: "10px", backgroundColor: colors.bgSunken, display: "grid", placeItems: "center", color: colors.ink2 },
  chev: { display: "inline-flex", color: colors.ink3 },
  chevOpen: { transform: "rotate(90deg)" },
  member: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 18px 8px 64px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px", color: colors.ink2 },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", flexShrink: 0 },
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

function Members({ token, id }: { token: string | null; id: string }) {
  const q = useQuery({ queryKey: ["collection-members", id, token], queryFn: () => getMembers(token, id) });
  if (q.isPending) return <div {...stylex.props(styles.member)}>Loading…</div>;
  if (q.isError) return <div {...stylex.props(styles.member)}><ErrorState error={q.error} /></div>;
  if (q.data.length === 0) return <div {...stylex.props(styles.member)}>No assets in this collection yet.</div>;
  return (
    <>
      {q.data.map((m) => (
        <div key={m.assetId} {...stylex.props(styles.member)} data-testid="collection-member">
          <Box size={14} /> {m.title}
        </div>
      ))}
    </>
  );
}

function NewCollectionModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () => createCollection(token, name.trim(), description.trim() || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["collections"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-collection" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New collection</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fine art" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Description (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** F04 — asset collections: named groupings of registry assets. Expand a collection to see its
  * members; create new ones. Registry-private (the nav gates on `asset`). */
export function Collections() {
  const { token } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const collections = useQuery({ queryKey: ["collections", token], queryFn: () => listCollections(token) });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Inventory · Collections</div>
          <h1 {...stylex.props(styles.title)}>Collections</h1>
          <div {...stylex.props(styles.desc)}>Named groupings of registry assets — a watch rotation, the art, a wine cellar. Expand one to see its pieces.</div>
        </div>
        <button type="button" onClick={() => setAdding(true)} {...stylex.props(styles.btn)}><Plus size={14} /> New collection</button>
      </header>

      {adding && <NewCollectionModal token={token} onClose={() => setAdding(false)} />}

      <Card>
        <CardHeader><CardTitle>Collections · {collections.data?.length ?? 0}</CardTitle></CardHeader>
        {collections.isPending ? <Loading /> : collections.isError ? <ErrorState error={collections.error} />
          : collections.data.length === 0 ? <EmptyState title="No collections yet">Create a collection to group related assets.</EmptyState>
          : collections.data.map((c) => (
            <div key={c.id}>
              <CardRow onClick={() => setOpen(open === c.id ? null : c.id)} testId="collection-row">
                <div {...stylex.props(styles.icon)}><Box size={16} /></div>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.cname)}>{c.name}</div>
                  {c.description && <div {...stylex.props(styles.cdesc)}>{c.description}</div>}
                </div>
                <Pill>{c.memberCount} {c.memberCount === 1 ? "asset" : "assets"}</Pill>
                <span {...stylex.props(styles.chev, open === c.id && styles.chevOpen)}><ChevronRight size={16} /></span>
              </CardRow>
              {open === c.id && <Members token={token} id={c.id} />}
            </div>
          ))}
      </Card>
    </div>
  );
}

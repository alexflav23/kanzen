import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { createEntity, listEntities, updateEntity, type Entity } from "../services/wealth";
import { listCurrencies } from "../services/fx";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const KINDS = ["individual", "trust", "company", "foundation", "partnership"];

const styles = stylex.create({
  page: { maxWidth: "860px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, marginBottom: "8px" },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "13px 18px", borderBottom: `1px solid ${colors.line}` },
  indent: (d: number) => ({ paddingLeft: `${18 + d * 26}px` }),
  branch: { color: colors.ink4, fontSize: "12px", flexShrink: 0 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontWeight: 500, color: colors.ink },
  meta: { fontSize: "12.5px", color: colors.ink3, marginTop: "2px", textTransform: "capitalize" },
  edit: { padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  hint: { fontSize: "11.5px", color: colors.ink4, marginTop: "5px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
});

function EntityModal({ entity, entities, token, onClose }: { entity?: Entity; entities: Entity[]; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = entity != null;
  const currenciesQ = useQuery({ queryKey: ["currencies", token], queryFn: () => listCurrencies(token), enabled: !editing });
  const [name, setName] = useState(entity?.name ?? "");
  const [kind, setKind] = useState(entity?.kind ?? "individual");
  const [jurisdiction, setJurisdiction] = useState(entity?.jurisdiction ?? "");
  const [baseCurrency, setBaseCurrency] = useState(entity?.baseCurrency ?? "GBP");
  const [parentEntityId, setParentEntityId] = useState(entity?.parentEntityId ?? "");

  const save = useMutation({
    mutationFn: () => {
      const j = jurisdiction.trim() || null;
      const parent = parentEntityId || null;
      return editing
        ? updateEntity(entity.id, { name: name.trim(), kind, jurisdiction: j, parentEntityId: parent }, token)
        : createEntity({ name: name.trim(), kind, jurisdiction: j, baseCurrency, parentEntityId: parent }, token);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wealth", "entities"] }); onClose(); },
  });

  // a parent can be any other entity (self excluded to avoid the trivial cycle the server also rejects)
  const parentChoices = entities.filter((e) => e.id !== entity?.id);

  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="entity-modal" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>{editing ? "Edit entity" : "New entity"}</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wardian Family Trust" autoFocus /></label>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Kind</span>
            <select {...stylex.props(styles.control)} aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Jurisdiction</span>
            <input {...stylex.props(styles.control)} aria-label="Jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. UK" /></label>
        </div>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Base currency</span>
            {editing
              ? <input {...stylex.props(styles.control)} aria-label="Base currency" value={baseCurrency} disabled readOnly />
              : <select {...stylex.props(styles.control)} aria-label="Base currency" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                  {(currenciesQ.data ?? [{ code: "GBP", symbol: "£", decimals: 2 }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>}
            {editing && <div {...stylex.props(styles.hint)}>Base currency is fixed once a book exists.</div>}
          </label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Owned by (parent)</span>
            <select {...stylex.props(styles.control)} aria-label="Parent entity" value={parentEntityId} onChange={(e) => setParentEntityId(e.target.value)}>
              <option value="">— none (top-level)</option>
              {parentChoices.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></label>
        </div>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.btn)} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving…" : editing ? "Save" : "Add entity"}</button>
        </div>
      </form>
    </div>
  );
}

/** F42 (W7.2) — entity management: the ownership tree of legal/family entities (books), with create + edit.
 * Principal-private — the wealth API hard-403s anyone else (rendered as an error state). */
export function Entities() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const entitiesQ = useQuery({ queryKey: ["wealth", "entities", token], queryFn: () => listEntities(token) });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);

  const back = <button type="button" onClick={() => navigate("/wealth")} {...stylex.props(styles.back)}>← Wealth</button>;
  const all = entitiesQ.data ?? [];
  const byParent = new Map<string | null, Entity[]>();
  for (const e of all) { const k = e.parentEntityId ?? null; byParent.set(k, [...(byParent.get(k) ?? []), e]); }

  const renderNodes = (parentId: string | null, depth: number): React.ReactNode[] =>
    (byParent.get(parentId) ?? []).flatMap((e) => [
      <div key={e.id} {...stylex.props(styles.row, styles.indent(depth))} data-testid="entity-row">
        {depth > 0 && <span {...stylex.props(styles.branch)}>└</span>}
        <div {...stylex.props(styles.grow)}>
          <div {...stylex.props(styles.name)}>{e.name}</div>
          <div {...stylex.props(styles.meta)}>{[e.kind, e.jurisdiction?.toUpperCase()].filter(Boolean).join(" · ")}</div>
        </div>
        <Pill>{e.baseCurrency}</Pill>
        <button type="button" {...stylex.props(styles.edit)} aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}>Edit</button>
      </div>,
      ...renderNodes(e.id, depth + 1),
    ]);

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      <div {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Private Wealth · Principal-private</div>
          <h1 {...stylex.props(styles.title)}>Entities</h1>
          <div {...stylex.props(styles.desc)}>Legal &amp; family entities and who owns whom. Each is its own set of books.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} onClick={() => setAdding(true)}><Plus size={14} /> New entity</button>
      </div>

      <Card>
        <CardHeader><CardTitle>Ownership · {all.length}</CardTitle></CardHeader>
        {entitiesQ.isPending ? <Loading label="Loading entities…" />
          : entitiesQ.isError ? <ErrorState error={entitiesQ.error} />
          : all.length === 0 ? <EmptyState title="No entities">Create a legal or family entity to hold the books.</EmptyState>
          : renderNodes(null, 0)}
      </Card>

      {adding && <EntityModal entities={all} token={token} onClose={() => setAdding(false)} />}
      {editing && <EntityModal entity={editing} entities={all} token={token} onClose={() => setEditing(null)} />}
    </div>
  );
}

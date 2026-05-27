import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Trash } from "../components/icons";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { useAuth } from "../state/AuthContext";
import { listTags, createTag } from "../services/tags";
import {
  listTaxonomies, createTaxonomy, listNodes, addNode,
  listCustomFields, createCustomField, deleteCustomField,
  ENTITY_TYPES, FIELD_TYPES,
} from "../services/extensibility";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "640px" },
  card: { marginBottom: "20px" },
  chips: { display: "flex", flexWrap: "wrap", gap: "6px", padding: "4px 4px 0" },
  row: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 4px", borderTop: `1px solid ${colors.line}` },
  indent: (px: number) => ({ paddingLeft: `${px}px` }),
  grow: { flex: 1, minWidth: 0 },
  name: { fontSize: "13.5px", color: colors.ink, fontWeight: 500 },
  meta: { fontSize: "12px", color: colors.ink3 },
  del: { border: 0, background: "transparent", color: colors.ink4, cursor: "pointer", padding: "2px" },
  addRow: { display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", paddingTop: "14px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "11px", color: colors.ink3 },
  input: { padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", minWidth: "150px" },
  select: { padding: "7px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "13px", cursor: "pointer" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  disabled: { opacity: 0.5, cursor: "not-allowed" },
  check: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: colors.ink2 },
  err: { fontSize: "12.5px", color: colors.danger, padding: "8px 4px" },
  empty: { padding: "12px 4px", fontSize: "13px", color: colors.ink3 },
});

function TagsCard({ canWrite }: { canWrite: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tags", token], queryFn: () => listTags(token) });
  const [name, setName] = useState("");
  const add = useMutation({ mutationFn: () => createTag(name.trim(), token), onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["tags"] }); } });
  return (
    <Card style={styles.card}>
      <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
      {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} /> : (
        <div {...stylex.props(styles.chips)}>
          {q.data.length === 0 && <span {...stylex.props(styles.empty)}>No tags yet.</span>}
          {q.data.map((t) => <Pill key={t.id}>{t.name}</Pill>)}
        </div>
      )}
      {canWrite && (
        <div {...stylex.props(styles.addRow)}>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="new-tag">New tag</label>
            <input id="new-tag" {...stylex.props(styles.input)} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Heirloom" />
          </div>
          <button type="button" {...stylex.props(styles.btn, (!name.trim() || add.isPending) && styles.disabled)} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            <Plus size={13} /> Add tag
          </button>
        </div>
      )}
    </Card>
  );
}

function CustomFieldsCard({ canWrite }: { canWrite: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState<string>("asset");
  const q = useQuery({ queryKey: ["custom-fields", entityType, token], queryFn: () => listCustomFields(token, entityType) });
  const [draft, setDraft] = useState({ key: "", label: "", type: "text", sensitive: false });
  const inv = () => qc.invalidateQueries({ queryKey: ["custom-fields"] });
  const add = useMutation({
    mutationFn: () => createCustomField(token, { entityType, key: draft.key.trim(), label: draft.label.trim(), type: draft.type, enumValues: null, sensitive: draft.sensitive }),
    onSuccess: () => { setDraft({ key: "", label: "", type: "text", sensitive: false }); inv(); },
  });
  const del = useMutation({ mutationFn: (id: string) => deleteCustomField(token, id), onSuccess: inv });
  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Custom fields</CardTitle>
        <select {...stylex.props(styles.select)} aria-label="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </CardHeader>
      {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} /> : q.data.length === 0 ? (
        <div {...stylex.props(styles.empty)}>No custom fields on {entityType.replace(/_/g, " ")}.</div>
      ) : (
        q.data.map((f) => (
          <div key={f.id} {...stylex.props(styles.row)} data-testid="field-row">
            <div {...stylex.props(styles.grow)}>
              <span {...stylex.props(styles.name)}>{f.label}</span> <span {...stylex.props(styles.meta)}>· {f.key} · {f.type}{f.sensitive ? " · sensitive" : ""}</span>
            </div>
            {canWrite && <button type="button" {...stylex.props(styles.del)} aria-label={`Delete field ${f.label}`} onClick={() => del.mutate(f.id)}><Trash size={14} /></button>}
          </div>
        ))
      )}
      {canWrite && (
        <div {...stylex.props(styles.addRow)}>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="cf-key">Key</label>
            <input id="cf-key" {...stylex.props(styles.input)} value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="e.g. warranty_ref" />
          </div>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="cf-label">Label</label>
            <input id="cf-label" {...stylex.props(styles.input)} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Warranty reference" />
          </div>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="cf-type">Type</label>
            <select id="cf-type" {...stylex.props(styles.select)} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label {...stylex.props(styles.check)}>
            <input type="checkbox" checked={draft.sensitive} onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked })} /> Sensitive
          </label>
          <button type="button" {...stylex.props(styles.btn, (!draft.key.trim() || !draft.label.trim() || add.isPending) && styles.disabled)} disabled={!draft.key.trim() || !draft.label.trim() || add.isPending} onClick={() => add.mutate()}>
            <Plus size={13} /> Add field
          </button>
        </div>
      )}
    </Card>
  );
}

function TaxonomiesCard({ canWrite }: { canWrite: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const taxQ = useQuery({ queryKey: ["taxonomies", token], queryFn: () => listTaxonomies(token) });
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ?? taxQ.data?.[0]?.id ?? null;
  const nodesQ = useQuery({ queryKey: ["taxonomy-nodes", sel, token], queryFn: () => listNodes(token, sel!), enabled: !!sel });
  const [newTax, setNewTax] = useState({ name: "", appliesTo: "asset" });
  const [node, setNode] = useState({ parentId: "", name: "" });
  const invTax = () => qc.invalidateQueries({ queryKey: ["taxonomies"] });
  const invNodes = () => qc.invalidateQueries({ queryKey: ["taxonomy-nodes"] });
  const createTax = useMutation({ mutationFn: () => createTaxonomy(token, newTax.name.trim(), newTax.appliesTo), onSuccess: (t) => { setNewTax({ name: "", appliesTo: "asset" }); setSelected(t.id); invTax(); } });
  const addNodeMut = useMutation({ mutationFn: () => addNode(token, sel!, node.parentId || null, node.name.trim()), onSuccess: () => { setNode({ parentId: "", name: "" }); invNodes(); } });

  const depthOf = (nodes: { id: string; parentId: string | null }[], id: string | null): number => {
    let d = 0; let cur = nodes.find((n) => n.id === id)?.parentId ?? null;
    while (cur) { d++; cur = nodes.find((n) => n.id === cur)?.parentId ?? null; }
    return d;
  };

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Taxonomies</CardTitle>
        {taxQ.data && taxQ.data.length > 0 && (
          <select {...stylex.props(styles.select)} aria-label="Taxonomy" value={sel ?? ""} onChange={(e) => setSelected(e.target.value)}>
            {taxQ.data.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.appliesTo})</option>)}
          </select>
        )}
      </CardHeader>
      {taxQ.isPending ? <Loading /> : taxQ.isError ? <ErrorState error={taxQ.error} /> : (
        <>
          {canWrite && (
            <div {...stylex.props(styles.addRow)}>
              <div {...stylex.props(styles.fieldGroup)}>
                <label {...stylex.props(styles.label)} htmlFor="tax-name">New taxonomy</label>
                <input id="tax-name" {...stylex.props(styles.input)} value={newTax.name} onChange={(e) => setNewTax({ ...newTax, name: e.target.value })} placeholder="e.g. Provenance regions" />
              </div>
              <div {...stylex.props(styles.fieldGroup)}>
                <label {...stylex.props(styles.label)} htmlFor="tax-applies">Applies to</label>
                <select id="tax-applies" {...stylex.props(styles.select)} value={newTax.appliesTo} onChange={(e) => setNewTax({ ...newTax, appliesTo: e.target.value })}>
                  {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <button type="button" {...stylex.props(styles.btn, (!newTax.name.trim() || createTax.isPending) && styles.disabled)} disabled={!newTax.name.trim() || createTax.isPending} onClick={() => createTax.mutate()}>
                <Plus size={13} /> Add taxonomy
              </button>
            </div>
          )}
          {sel && nodesQ.data && (
            <>
              {nodesQ.data.length === 0
                ? <div {...stylex.props(styles.empty)}>No nodes yet — add the first below.</div>
                : nodesQ.data.map((n) => (
                    <div key={n.id} {...stylex.props(styles.row, styles.indent(4 + depthOf(nodesQ.data, n.id) * 18))} data-testid="node-row">
                      <span {...stylex.props(styles.name)}>{n.name}</span>
                    </div>
                  ))}
              {canWrite && (
                <div {...stylex.props(styles.addRow)}>
                  <div {...stylex.props(styles.fieldGroup)}>
                    <label {...stylex.props(styles.label)} htmlFor="node-parent">Under</label>
                    <select id="node-parent" {...stylex.props(styles.select)} value={node.parentId} onChange={(e) => setNode({ ...node, parentId: e.target.value })}>
                      <option value="">— top level —</option>
                      {nodesQ.data.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                  <div {...stylex.props(styles.fieldGroup)}>
                    <label {...stylex.props(styles.label)} htmlFor="node-name">Node</label>
                    <input id="node-name" {...stylex.props(styles.input)} value={node.name} onChange={(e) => setNode({ ...node, name: e.target.value })} placeholder="e.g. Switzerland" />
                  </div>
                  <button type="button" {...stylex.props(styles.btn, (!node.name.trim() || addNodeMut.isPending) && styles.disabled)} disabled={!node.name.trim() || addNodeMut.isPending} onClick={() => addNodeMut.mutate()}>
                    <Plus size={13} /> Add node
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

/** F33 — Principal-define extensibility: tags, custom-field definitions, and user-defined taxonomy trees. */
export function Customization() {
  const { can } = useAuth();
  if (!can("custom_field", "read") && !can("taxonomy", "read") && !can("tag", "read")) {
    return (
      <div>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.eyebrow)}>Finance &amp; system · customization</div>
          <h1 {...stylex.props(styles.title)}>Customization</h1>
        </header>
        <EmptyState title="Not available">You don't have access to the data-model customization.</EmptyState>
      </div>
    );
  }
  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Finance &amp; system · customization</div>
        <h1 {...stylex.props(styles.title)}>Customization</h1>
        <p {...stylex.props(styles.desc)}>
          Shape the registry to the estate: define <strong>tags</strong>, typed <strong>custom fields</strong> per
          entity, and your own <strong>taxonomy</strong> trees. Definitions are Principal-set; everyone uses them.
        </p>
      </header>
      <TagsCard canWrite={can("tag", "write")} />
      <CustomFieldsCard canWrite={can("custom_field", "write")} />
      <TaxonomiesCard canWrite={can("taxonomy", "write")} />
    </div>
  );
}

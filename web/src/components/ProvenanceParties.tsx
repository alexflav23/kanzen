import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus, Trash } from "./icons";
import { Loading, ErrorState, EmptyState } from "./states";
import { useAuth } from "../state/AuthContext";
import { addParty, listParties, removeParty, PARTY_ROLES } from "../services/assets";

const label = (role: string) => role.replace(/_/g, " ");

const styles = stylex.create({
  row: { display: "flex", alignItems: "baseline", gap: "10px", padding: "9px 0", borderTop: `1px solid ${colors.line}` },
  role: { width: "92px", flexShrink: 0, fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, paddingTop: "2px" },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: "13.5px", color: colors.ink, fontWeight: 500 },
  note: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  del: { border: 0, background: "transparent", color: colors.ink4, cursor: "pointer", padding: "2px" },
  addRow: { display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", paddingTop: "14px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  flabel: { fontSize: "11px", color: colors.ink3 },
  select: { padding: "7px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "13px", cursor: "pointer" },
  input: { padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", minWidth: "150px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

/** F21 — provenance party-roles (maker / restorer / appraiser / prior owner / dealer / insurer). */
export function ProvenanceParties({ assetId, canEdit }: { assetId: string; canEdit: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["asset-parties", assetId, token], queryFn: () => listParties(assetId, token) });
  const [role, setRole] = useState<string>("maker");
  const [name, setName] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["asset-parties", assetId] });
  const addMut = useMutation({
    mutationFn: () => addParty(assetId, token, { role, name: name.trim(), note: null }),
    onSuccess: () => { setName(""); inv(); },
  });
  const delMut = useMutation({ mutationFn: (id: string) => removeParty(assetId, token, id), onSuccess: inv });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} />;

  return (
    <div>
      {q.data.length === 0
        ? <EmptyState title="No provenance recorded">Add the maker, restorer, appraiser or prior owners.</EmptyState>
        : q.data.map((p) => (
            <div key={p.id} {...stylex.props(styles.row)} data-testid="party-row">
              <span {...stylex.props(styles.role)}>{label(p.role)}</span>
              <div {...stylex.props(styles.body)}>
                <div {...stylex.props(styles.name)}>{p.name}</div>
                {p.note && <div {...stylex.props(styles.note)}>{p.note}</div>}
              </div>
              {canEdit && (
                <button type="button" {...stylex.props(styles.del)} aria-label={`Remove ${label(p.role)} ${p.name}`} onClick={() => delMut.mutate(p.id)}>
                  <Trash size={14} />
                </button>
              )}
            </div>
          ))}
      {canEdit && (
        <div {...stylex.props(styles.addRow)}>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.flabel)} htmlFor="party-role">Role</label>
            <select id="party-role" {...stylex.props(styles.select)} value={role} onChange={(e) => setRole(e.target.value)}>
              {PARTY_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </select>
          </div>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.flabel)} htmlFor="party-name">Name</label>
            <input id="party-name" {...stylex.props(styles.input)} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Audemars Piguet" />
          </div>
          <button type="button" {...stylex.props(styles.btn)} disabled={!name.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
            <Plus size={13} /> Add party
          </button>
        </div>
      )}
    </div>
  );
}

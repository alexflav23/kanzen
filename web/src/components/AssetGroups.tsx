import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus, X } from "./icons";
import { addToGroup, createGroup, groupsForAsset, listGroups, removeFromGroup, GROUP_KINDS } from "../services/groups";
import { useAuth } from "../state/AuthContext";

const styles = stylex.create({
  wrap: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" },
  chip: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 6px 3px 10px", borderRadius: radius.pill, backgroundColor: colors.bgSunken, color: colors.ink, fontSize: "12px", fontWeight: 500 },
  chipStatic: { padding: "3px 10px" },
  kind: { fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600 },
  rm: { display: "inline-flex", alignItems: "center", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", padding: "1px", borderRadius: radius.pill, opacity: 0.7 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: radius.pill, border: `1px dashed ${colors.line}`, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12px" },
  form: { display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  input: { padding: "4px 9px", borderRadius: radius.sm, border: `1px solid ${colors.accent}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12px", width: "150px", outline: { default: "none", ":focus": "none" } },
  select: { padding: "4px 8px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12px" },
  go: { padding: "4px 10px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12px" },
  none: { fontSize: "12.5px", color: colors.ink4 },
});

/**
 * The groups (structural peer groupings) an asset belongs to. Shows chips (name + kind) and,
 * for writers, an add control that picks/creates a group by name + kind, plus per-chip remove.
 */
export function AssetGroups({ assetId, readOnly = false }: { assetId: string; readOnly?: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("set");

  const groupsQ = useQuery({ queryKey: ["groups-for", assetId, token], queryFn: () => groupsForAsset(token, assetId) });
  const allQ = useQuery({ queryKey: ["groups", token], queryFn: () => listGroups(token), enabled: adding });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["groups-for", assetId] });

  const add = useMutation({
    mutationFn: async () => {
      const nm = name.trim();
      const existing = (allQ.data ?? []).find((g) => g.name.toLowerCase() === nm.toLowerCase());
      const group = existing ?? (await createGroup(token, { name: nm, kind, notes: null }));
      await addToGroup(token, assetId, group.id);
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["groups"] }); setName(""); setAdding(false); },
  });
  const remove = useMutation({ mutationFn: (groupId: string) => removeFromGroup(token, assetId, groupId), onSuccess: invalidate });

  const submit = () => { if (name.trim()) add.mutate(); };
  const groups = groupsQ.data ?? [];

  return (
    <div {...stylex.props(styles.wrap)}>
      {groups.map((g) => (
        <span {...stylex.props(styles.chip, readOnly && styles.chipStatic)} key={g.id} data-testid="group-chip">
          {g.name}
          <span {...stylex.props(styles.kind)}>{g.kind}</span>
          {!readOnly && (
            <button type="button" {...stylex.props(styles.rm)} aria-label={`Remove from group ${g.name}`} disabled={remove.isPending} onClick={() => remove.mutate(g.id)}>
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {groups.length === 0 && readOnly && <span {...stylex.props(styles.none)}>No groups</span>}
      {!readOnly && (adding ? (
        <span {...stylex.props(styles.form)}>
          <input
            {...stylex.props(styles.input)}
            aria-label="Group name"
            list={listId}
            autoFocus
            value={name}
            placeholder="group name…"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
          />
          <datalist id={listId}>{(allQ.data ?? []).map((g) => <option key={g.id} value={g.name} />)}</datalist>
          <select {...stylex.props(styles.select)} aria-label="Group kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {GROUP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button type="button" {...stylex.props(styles.go)} disabled={!name.trim() || add.isPending} onClick={submit}>Add</button>
        </span>
      ) : (
        <button type="button" {...stylex.props(styles.addBtn)} data-testid="add-group" onClick={() => setAdding(true)}>
          <Plus size={11} /> Group
        </button>
      ))}
    </div>
  );
}

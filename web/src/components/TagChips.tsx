import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Plus, X } from "./icons";
import { createTag, listTags, tagEntity, tagsFor, untagEntity } from "../services/tags";
import { useAuth } from "../state/AuthContext";

const styles = stylex.create({
  wrap: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" },
  chip: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 6px 3px 10px", borderRadius: radius.pill, backgroundColor: colors.accentSoft, color: colors.accent, fontSize: "12px", fontWeight: 500 },
  chipStatic: { padding: "3px 10px" },
  rm: { display: "inline-flex", alignItems: "center", border: 0, background: "transparent", color: colors.accent, cursor: "pointer", padding: "1px", borderRadius: radius.pill, opacity: 0.7 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: radius.pill, border: `1px dashed ${colors.line}`, backgroundColor: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12px" },
  input: { padding: "4px 9px", borderRadius: radius.pill, border: `1px solid ${colors.accent}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12px", width: "150px", outline: { default: "none", ":focus": "none" } },
  none: { fontSize: "12.5px", color: colors.ink4 },
});

/**
 * Tag chips for any entity (F33 polymorphic tags). Shows the entity's tags + (for writers) an
 * inline add control that picks an existing tag or creates a new one, plus per-chip remove.
 * Reusable across asset/property/etc. by passing a different `entityType`.
 */
export function TagChips({ entityType, entityId, readOnly = false }: { entityType: string; entityId: string; readOnly?: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const tagsQ = useQuery({ queryKey: ["tags-for", entityType, entityId, token], queryFn: () => tagsFor(entityType, entityId, token) });
  const allQ = useQuery({ queryKey: ["tags", token], queryFn: () => listTags(token), enabled: adding });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tags-for", entityType, entityId] });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const existing = (allQ.data ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
      const tag = existing ?? (await createTag(name, token));
      await tagEntity(tag.id, entityType, entityId, token);
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["tags"] }); setText(""); setAdding(false); },
  });
  const remove = useMutation({ mutationFn: (tagId: string) => untagEntity(tagId, entityType, entityId, token), onSuccess: invalidate });

  const submit = () => { const v = text.trim(); if (v) add.mutate(v); };
  const tags = tagsQ.data ?? [];

  return (
    <div {...stylex.props(styles.wrap)}>
      {tags.map((t) => (
        <span {...stylex.props(styles.chip, readOnly && styles.chipStatic)} key={t.id} data-testid="tag-chip">
          {t.name}
          {!readOnly && (
            <button type="button" {...stylex.props(styles.rm)} aria-label={`Remove tag ${t.name}`} disabled={remove.isPending} onClick={() => remove.mutate(t.id)}>
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {tags.length === 0 && readOnly && <span {...stylex.props(styles.none)}>No tags</span>}
      {!readOnly && (adding ? (
        <>
          <input
            {...stylex.props(styles.input)}
            aria-label="Add a tag"
            list={listId}
            autoFocus
            value={text}
            placeholder="tag…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setText(""); } }}
            onBlur={() => { if (!text.trim()) setAdding(false); }}
          />
          <datalist id={listId}>
            {(allQ.data ?? []).map((t) => <option key={t.id} value={t.name} />)}
          </datalist>
        </>
      ) : (
        <button type="button" {...stylex.props(styles.addBtn)} data-testid="add-tag" onClick={() => setAdding(true)}>
          <Plus size={11} /> Tag
        </button>
      ))}
    </div>
  );
}

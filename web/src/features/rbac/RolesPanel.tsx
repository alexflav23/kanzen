import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading, ErrorState } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { ApiError } from "../../services/http";
import { getRoles } from "../../services/roles";
import { attachSet, detachSet, getComposition, listSets, setParent } from "../../services/rbac";
import { rbac } from "./rbacStyles";

/** F02 v2 builder — role composition: a role inherits a parent role's rules + sets, and bundles permission sets. */
export function RolesPanel() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles", token], queryFn: () => getRoles(token) });
  const sets = useQuery({ queryKey: ["rbac", "sets", token], queryFn: () => listSets(token) });
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ?? roles.data?.[0]?.name ?? null;

  const comp = useQuery({
    queryKey: ["rbac", "composition", sel, token],
    queryFn: () => getComposition(token, sel!),
    enabled: !!sel,
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["rbac", "composition"] });
  const parentMut = useMutation({ mutationFn: (p: string | null) => setParent(token, sel!, p), onSuccess: inv });
  const attachMut = useMutation({ mutationFn: (id: string) => attachSet(token, sel!, id), onSuccess: inv });
  const detachMut = useMutation({ mutationFn: (id: string) => detachSet(token, sel!, id), onSuccess: inv });

  if (roles.isPending || sets.isPending) return <Loading />;
  if (roles.isError) return <ErrorState error={roles.error} />;
  if (sets.isError) return <ErrorState error={sets.error} />;

  const attached = new Set(comp.data?.setIds ?? []);
  const parentErr = parentMut.error instanceof ApiError ? parentMut.error.detail : null;

  return (
    <div {...stylex.props(rbac.twoCol)}>
      <aside {...stylex.props(rbac.side)} aria-label="Roles">
        {roles.data.map((r) => (
          <button key={r.name} type="button" {...stylex.props(rbac.sideItem, r.name === sel && rbac.sideItemActive)} aria-current={r.name === sel} onClick={() => setSelected(r.name)}>
            <span {...stylex.props(rbac.sideName)}>{r.name}</span>
            <span {...stylex.props(rbac.sideMeta)}>{r.isSystem ? "system" : "custom"}{r.description ? ` · ${r.description}` : ""}</span>
          </button>
        ))}
      </aside>

      <section {...stylex.props(rbac.main)}>
        {!sel ? <div {...stylex.props(rbac.empty)}>No roles yet.</div> : comp.isPending ? <Loading /> : comp.isError ? <ErrorState error={comp.error} /> : (
          <>
            <div {...stylex.props(rbac.sectionTitle)}>{sel}</div>
            <div {...stylex.props(rbac.sectionDesc)}>A role inherits its parent's rules + sets, then layers its own permission sets on top. Cycles are rejected.</div>

            <div {...stylex.props(rbac.fieldGroup)}>
              <label {...stylex.props(rbac.label)} htmlFor="parent-role">Inherits from (parent role)</label>
              <select id="parent-role" {...stylex.props(rbac.select)} value={comp.data?.parentRole ?? ""} onChange={(e) => parentMut.mutate(e.target.value || null)}>
                <option value="">— none —</option>
                {roles.data.filter((r) => r.name !== sel).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
              {parentErr && <div {...stylex.props(rbac.err)} role="alert">{parentErr}</div>}
            </div>

            <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Permission sets</div>
            <div {...stylex.props(rbac.sectionDesc)}>Tick the sets this role includes.</div>
            <div {...stylex.props(rbac.chips)}>
              {sets.data.length === 0 && <span {...stylex.props(rbac.muted)}>No permission sets yet — create some in the Permission sets tab.</span>}
              {sets.data.map((s) => {
                const on = attached.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    {...stylex.props(rbac.chip, on && rbac.chipOn)}
                    aria-pressed={on}
                    disabled={attachMut.isPending || detachMut.isPending}
                    onClick={() => (on ? detachMut.mutate(s.id) : attachMut.mutate(s.id))}
                  >
                    {on ? "✓ " : "+ "}{s.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

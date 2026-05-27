import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading, ErrorState } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { ApiError } from "../../services/http";
import {
  createSet, deleteGrant, deleteSet, getCatalogue, getGrants, listSets, upsertGrant,
  type CatalogueAction, type Grant,
} from "../../services/rbac";
import { rbac } from "./rbacStyles";

const SCOPES = ["all", "property", "team", "own"] as const;

/** F02 v2 builder — permission sets: object × verb grants with allow/deny + scope, off the live action catalogue. */
export function PermissionSetsPanel() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const sets = useQuery({ queryKey: ["rbac", "sets", token], queryFn: () => listSets(token) });
  const catalogue = useQuery({ queryKey: ["rbac", "catalogue", token], queryFn: () => getCatalogue(token) });
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const sel = sets.data?.find((s) => s.id === selected) ?? sets.data?.[0] ?? null;
  const selId = sel?.id ?? null;
  const grants = useQuery({
    queryKey: ["rbac", "grants", selId, token],
    queryFn: () => getGrants(token, selId!),
    enabled: !!selId,
  });

  const invSets = () => qc.invalidateQueries({ queryKey: ["rbac", "sets"] });
  const invGrants = () => qc.invalidateQueries({ queryKey: ["rbac", "grants"] });
  const createMut = useMutation({
    mutationFn: () => createSet(token, newName.trim(), null),
    onSuccess: (s) => { setNewName(""); setSelected(s.id); invSets(); },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => deleteSet(token, id), onSuccess: () => { setSelected(null); invSets(); } });
  const grantMut = useMutation({ mutationFn: (g: Grant) => upsertGrant(token, selId!, g), onSuccess: () => { invGrants(); invSets(); } });
  const ungrantMut = useMutation({
    mutationFn: (g: { resource: string; action: string }) => deleteGrant(token, selId!, g.resource, g.action, ""),
    onSuccess: () => { invGrants(); invSets(); },
  });

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogueAction[]>();
    for (const a of catalogue.data ?? []) {
      const list = m.get(a.resource) ?? [];
      list.push(a);
      m.set(a.resource, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalogue.data]);

  const grantOf = (resource: string, verb: string): Grant | undefined =>
    grants.data?.find((g) => g.resource === resource && g.action === verb && g.field === "");

  const setEffect = (resource: string, verb: string, effect: "allow" | "deny" | "off") => {
    if (!selId) return;
    if (effect === "off") ungrantMut.mutate({ resource, action: verb });
    else {
      const cur = grantOf(resource, verb);
      grantMut.mutate({ resource, action: verb, field: "", scope: cur?.scope ?? "all", effect });
    }
  };
  const setScope = (resource: string, verb: string, scope: string) =>
    selId && grantMut.mutate({ resource, action: verb, field: "", scope, effect: "allow" });

  if (sets.isPending || catalogue.isPending) return <Loading />;
  if (sets.isError) return <ErrorState error={sets.error} />;
  if (catalogue.isError) return <ErrorState error={catalogue.error} />;

  return (
    <div {...stylex.props(rbac.twoCol)}>
      <aside {...stylex.props(rbac.side)} aria-label="Permission sets">
        {sets.data.map((s) => (
          <button
            key={s.id}
            type="button"
            {...stylex.props(rbac.sideItem, s.id === selId && rbac.sideItemActive)}
            aria-current={s.id === selId}
            onClick={() => setSelected(s.id)}
          >
            <span {...stylex.props(rbac.sideName)}>{s.name}</span>
            <span {...stylex.props(rbac.sideMeta)}>{s.grantCount} grant{s.grantCount === 1 ? "" : "s"}{s.isSystem ? " · system" : ""}</span>
          </button>
        ))}
        <div {...stylex.props(rbac.addRow)}>
          <div {...stylex.props(rbac.fieldGroup)}>
            <label {...stylex.props(rbac.label)} htmlFor="new-set">New permission set</label>
            <input id="new-set" {...stylex.props(rbac.input)} placeholder="e.g. Bill approver" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        </div>
        <button type="button" {...stylex.props(rbac.btn, (!newName.trim() || createMut.isPending) && rbac.disabled)} disabled={!newName.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
          Add set
        </button>
        {createMut.isError && <div {...stylex.props(rbac.err)} role="alert">{createMut.error instanceof ApiError ? createMut.error.detail : "Couldn't create the set."}</div>}
      </aside>

      <section {...stylex.props(rbac.main)}>
        {!sel ? (
          <div {...stylex.props(rbac.empty)}>Create a permission set to start granting actions.</div>
        ) : (
          <>
            <div {...stylex.props(rbac.rowBetween)}>
              <div>
                <div {...stylex.props(rbac.sectionTitle)}>{sel.name}</div>
                <div {...stylex.props(rbac.sectionDesc)}>Toggle each action Allow / Deny and choose its scope. Deny always wins. Reusable across roles and teams.</div>
              </div>
              {!sel.isSystem && (
                <button type="button" {...stylex.props(rbac.btnGhost, rbac.btnDanger)} onClick={() => { if (window.confirm(`Delete the "${sel.name}" set?`)) deleteMut.mutate(sel.id); }}>
                  Delete set
                </button>
              )}
            </div>

            {grants.isPending ? <Loading /> : grants.isError ? <ErrorState error={grants.error} /> : (
              <div>
                {grouped.map(([resource, actions]) => {
                  const activeCount = actions.filter((a) => grantOf(resource, a.verb)).length;
                  const isOpen = open[resource] ?? activeCount > 0;
                  return (
                    <div key={resource} {...stylex.props(rbac.group)}>
                      <button type="button" {...stylex.props(rbac.groupHead)} aria-label={resource} aria-expanded={isOpen} onClick={() => setOpen({ ...open, [resource]: !isOpen })}>
                        <span {...stylex.props(rbac.groupName)}>{resource.replace(/_/g, " ")}</span>
                        <span {...stylex.props(rbac.groupCount)}>{activeCount > 0 ? `${activeCount} granted` : `${actions.length} actions`} {isOpen ? "▾" : "▸"}</span>
                      </button>
                      {isOpen && actions.map((a) => {
                        const g = grantOf(resource, a.verb);
                        const eff = g?.effect;
                        return (
                          <div key={a.verb} {...stylex.props(rbac.actionRow)}>
                            <span {...stylex.props(rbac.actionName)}>
                              <span {...stylex.props(rbac.actionVerb)}>{a.verb.replace(/_/g, " ")}</span>
                              {a.sensitive && <span {...stylex.props(rbac.sensitive)}>sensitive</span>}
                            </span>
                            <span {...stylex.props(rbac.actionControls)}>
                              {eff === "allow" && (
                                <select {...stylex.props(rbac.select)} aria-label={`Scope for ${resource}:${a.verb}`} value={g?.scope ?? "all"} onChange={(e) => setScope(resource, a.verb, e.target.value)}>
                                  {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              )}
                              <span {...stylex.props(rbac.seg)} role="group" aria-label={`${resource}:${a.verb} effect`}>
                                <button type="button" {...stylex.props(rbac.segBtn, !eff && rbac.segActive)} aria-pressed={!eff} onClick={() => setEffect(resource, a.verb, "off")}>Off</button>
                                <button type="button" {...stylex.props(rbac.segBtn, eff === "allow" && rbac.segAllow)} aria-pressed={eff === "allow"} onClick={() => setEffect(resource, a.verb, "allow")}>Allow</button>
                                <button type="button" {...stylex.props(rbac.segBtn, rbac.segBtnLast, eff === "deny" && rbac.segDeny)} aria-pressed={eff === "deny"} onClick={() => setEffect(resource, a.verb, "deny")}>Deny</button>
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

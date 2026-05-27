import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading, ErrorState } from "../../components/states";
import { Pill } from "../../components/Pill";
import { useAuth } from "../../state/AuthContext";
import { getRoles } from "../../services/roles";
import { addUserRole, getEffective, getUserRoles, listUsers, removeUserRole } from "../../services/rbac";
import { rbac } from "./rbacStyles";

/** F02 v2 builder — people: assign additional roles to a user and preview their *effective* permissions (the real
 *  Authz.forUser resolution: primary ∪ extra roles ∪ team roles ∪ inheritance ∪ set grants). */
export function PeoplePanel() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["rbac", "users", token], queryFn: () => listUsers(token) });
  const roles = useQuery({ queryKey: ["roles", token], queryFn: () => getRoles(token) });
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ?? users.data?.[0]?.id ?? null;
  const selUser = users.data?.find((u) => u.id === sel) ?? null;

  const extra = useQuery({ queryKey: ["rbac", "user-roles", sel, token], queryFn: () => getUserRoles(token, sel!), enabled: !!sel });
  const effective = useQuery({ queryKey: ["rbac", "effective", sel, token], queryFn: () => getEffective(token, sel!), enabled: !!sel });

  const inv = () => { qc.invalidateQueries({ queryKey: ["rbac", "user-roles"] }); qc.invalidateQueries({ queryKey: ["rbac", "effective"] }); };
  const roleMut = useMutation({
    mutationFn: (v: { role: string; on: boolean }) => (v.on ? removeUserRole(token, sel!, v.role) : addUserRole(token, sel!, v.role)),
    onSuccess: inv,
  });

  const byResource = useMemo(() => {
    const m = new Map<string, { verb: string; scope: string; sensitive: boolean }[]>();
    for (const a of effective.data?.allowed ?? []) {
      const list = m.get(a.resource) ?? [];
      list.push({ verb: a.verb, scope: a.scope, sensitive: a.sensitive });
      m.set(a.resource, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [effective.data]);

  if (users.isPending || roles.isPending) return <Loading />;
  if (users.isError) return <ErrorState error={users.error} />;
  if (roles.isError) return <ErrorState error={roles.error} />;

  const extraSet = new Set(extra.data ?? []);

  return (
    <div {...stylex.props(rbac.twoCol)}>
      <aside {...stylex.props(rbac.side)} aria-label="People">
        {users.data.map((u) => (
          <button key={u.id} type="button" {...stylex.props(rbac.sideItem, u.id === sel && rbac.sideItemActive)} aria-current={u.id === sel} onClick={() => setSelected(u.id)}>
            <span {...stylex.props(rbac.sideName)}>{u.displayName}</span>
            <span {...stylex.props(rbac.sideMeta)}>{u.role}</span>
          </button>
        ))}
      </aside>

      <section {...stylex.props(rbac.main)}>
        {!selUser ? <div {...stylex.props(rbac.empty)}>No accounts.</div> : (
          <>
            <div {...stylex.props(rbac.sectionTitle)}>{selUser.displayName}</div>
            <div {...stylex.props(rbac.sectionDesc)}>Primary role <strong>{selUser.role}</strong>. Add extra roles below; the preview shows what they can actually do once every role, team and set resolves.</div>

            <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Additional roles</div>
            <div {...stylex.props(rbac.chips)}>
              {roles.data.filter((r) => r.name !== selUser.role).map((r) => {
                const on = extraSet.has(r.name);
                return <button key={r.name} type="button" {...stylex.props(rbac.chip, on && rbac.chipOn)} aria-pressed={on} onClick={() => roleMut.mutate({ role: r.name, on })}>{on ? "✓ " : "+ "}{r.name}</button>;
              })}
            </div>

            <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Effective permissions</div>
            {effective.isPending ? <Loading /> : effective.isError ? <ErrorState error={effective.error} /> : effective.data ? (
              <>
                <div {...stylex.props(rbac.previewHead)} aria-label="Effective roles">
                  {effective.data.effectiveRoles.map((r) => <Pill key={r} tone="accent">{r}</Pill>)}
                  <span {...stylex.props(rbac.muted)}>{effective.data.allowed.length} actions allowed</span>
                </div>
                {byResource.length === 0 ? (
                  <div {...stylex.props(rbac.empty)}>No actions — this account is default-deny everywhere.</div>
                ) : (
                  byResource.map(([resource, actions]) => (
                    <div key={resource} {...stylex.props(rbac.group)}>
                      <div {...stylex.props(rbac.groupHead)}>
                        <span {...stylex.props(rbac.groupName)}>{resource.replace(/_/g, " ")}</span>
                        <span {...stylex.props(rbac.groupCount)}>{actions.length}</span>
                      </div>
                      {actions.map((a) => (
                        <div key={a.verb} {...stylex.props(rbac.actionRow)}>
                          <span {...stylex.props(rbac.actionName)}>
                            <span {...stylex.props(rbac.actionVerb)}>{a.verb.replace(/_/g, " ")}</span>
                            {a.sensitive && <span {...stylex.props(rbac.sensitive)}>sensitive</span>}
                          </span>
                          <span {...stylex.props(rbac.scopePill, a.scope !== "all" && rbac.scopeNarrow)}>{a.scope}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

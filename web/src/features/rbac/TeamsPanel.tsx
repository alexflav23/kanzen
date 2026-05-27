import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading, ErrorState } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { getRoles } from "../../services/roles";
import { listProperties } from "../../services/properties";
import {
  addMember, addTeamRole, addTeamScope, createTeam, deleteTeam, getTeam, listTeams, listUsers,
  removeMember, removeTeamRole, removeTeamScope,
} from "../../services/rbac";
import { rbac } from "./rbacStyles";

/** F02 v2 builder — nested teams: members inherit the team's roles and its ancestors' roles; property scopes narrow
 *  record access. */
export function TeamsPanel() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["rbac", "teams", token], queryFn: () => listTeams(token) });
  const users = useQuery({ queryKey: ["rbac", "users", token], queryFn: () => listUsers(token) });
  const roles = useQuery({ queryKey: ["roles", token], queryFn: () => getRoles(token) });
  const properties = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");

  const sel = selected ?? teams.data?.[0]?.id ?? null;
  const detail = useQuery({ queryKey: ["rbac", "team", sel, token], queryFn: () => getTeam(token, sel!), enabled: !!sel });

  const invTeams = () => qc.invalidateQueries({ queryKey: ["rbac", "teams"] });
  const invDetail = () => { qc.invalidateQueries({ queryKey: ["rbac", "team"] }); invTeams(); };
  const createMut = useMutation({
    mutationFn: () => createTeam(token, newName.trim(), newParent || null, null),
    onSuccess: (t) => { setNewName(""); setNewParent(""); setSelected(t.id); invTeams(); },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => deleteTeam(token, id), onSuccess: () => { setSelected(null); invTeams(); } });
  const memberMut = useMutation({ mutationFn: (v: { uid: string; on: boolean }) => v.on ? removeMember(token, sel!, v.uid) : addMember(token, sel!, v.uid), onSuccess: invDetail });
  const roleMut = useMutation({ mutationFn: (v: { role: string; on: boolean }) => v.on ? removeTeamRole(token, sel!, v.role) : addTeamRole(token, sel!, v.role), onSuccess: invDetail });
  const scopeMut = useMutation({ mutationFn: (v: { pid: string; on: boolean }) => v.on ? removeTeamScope(token, sel!, v.pid) : addTeamScope(token, sel!, v.pid), onSuccess: invDetail });

  if (teams.isPending) return <Loading />;
  if (teams.isError) return <ErrorState error={teams.error} />;

  const depthOf = (id: string | null): number => {
    let d = 0; let cur = teams.data!.find((t) => t.id === id)?.parentTeamId ?? null;
    while (cur) { d++; cur = teams.data!.find((t) => t.id === cur)?.parentTeamId ?? null; }
    return d;
  };
  const memberSet = new Set(detail.data?.members ?? []);
  const roleSet = new Set(detail.data?.roles ?? []);
  const scopeSet = new Set(detail.data?.propertyScopes ?? []);

  return (
    <div {...stylex.props(rbac.twoCol)}>
      <aside {...stylex.props(rbac.side)} aria-label="Teams">
        {teams.data.map((t) => (
          <button key={t.id} type="button" {...stylex.props(rbac.sideItem, depthOf(t.id) > 0 && rbac.sideIndent, t.id === sel && rbac.sideItemActive)} aria-current={t.id === sel} onClick={() => setSelected(t.id)}>
            <span {...stylex.props(rbac.sideName)}>{t.name}</span>
            <span {...stylex.props(rbac.sideMeta)}>{t.memberCount} member{t.memberCount === 1 ? "" : "s"} · {t.roleCount} role{t.roleCount === 1 ? "" : "s"}</span>
          </button>
        ))}
        <div {...stylex.props(rbac.addRow)}>
          <div {...stylex.props(rbac.fieldGroup)}>
            <label {...stylex.props(rbac.label)} htmlFor="new-team">New team</label>
            <input id="new-team" {...stylex.props(rbac.input)} placeholder="e.g. Singapore staff" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div {...stylex.props(rbac.fieldGroup)}>
            <label {...stylex.props(rbac.label)} htmlFor="new-team-parent">Nested under</label>
            <select id="new-team-parent" {...stylex.props(rbac.select)} value={newParent} onChange={(e) => setNewParent(e.target.value)}>
              <option value="">— top level —</option>
              {teams.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <button type="button" {...stylex.props(rbac.btn, (!newName.trim() || createMut.isPending) && rbac.disabled)} disabled={!newName.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Add team</button>
      </aside>

      <section {...stylex.props(rbac.main)}>
        {!sel ? <div {...stylex.props(rbac.empty)}>Create a team to group people and grant them roles.</div>
          : detail.isPending ? <Loading /> : detail.isError ? <ErrorState error={detail.error} /> : detail.data ? (
            <>
              <div {...stylex.props(rbac.rowBetween)}>
                <div>
                  <div {...stylex.props(rbac.sectionTitle)}>{detail.data.name}</div>
                  <div {...stylex.props(rbac.sectionDesc)}>
                    {detail.data.parentTeamId ? `Nested under ${teams.data.find((t) => t.id === detail.data!.parentTeamId)?.name ?? "a team"} — inherits its roles. ` : "Top-level team. "}
                    Members gain every role granted here and on ancestor teams.
                  </div>
                </div>
                <button type="button" {...stylex.props(rbac.btnGhost, rbac.btnDanger)} onClick={() => { if (window.confirm(`Delete the "${detail.data!.name}" team?`)) deleteMut.mutate(detail.data!.id); }}>Delete team</button>
              </div>

              <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Members</div>
              <div {...stylex.props(rbac.chips)}>
                {users.data?.map((u) => {
                  const on = memberSet.has(u.id);
                  return <button key={u.id} type="button" {...stylex.props(rbac.chip, on && rbac.chipOn)} aria-pressed={on} onClick={() => memberMut.mutate({ uid: u.id, on })}>{on ? "✓ " : "+ "}{u.displayName}</button>;
                })}
              </div>

              <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Roles granted to this team</div>
              <div {...stylex.props(rbac.chips)}>
                {roles.data?.map((r) => {
                  const on = roleSet.has(r.name);
                  return <button key={r.name} type="button" {...stylex.props(rbac.chip, on && rbac.chipOn)} aria-pressed={on} onClick={() => roleMut.mutate({ role: r.name, on })}>{on ? "✓ " : "+ "}{r.name}</button>;
                })}
              </div>

              <div {...stylex.props(rbac.sectionTitle, rbac.blockTop)}>Property scopes</div>
              <div {...stylex.props(rbac.sectionDesc)}>Limit this team's reach to specific properties (used by property-scoped grants).</div>
              <div {...stylex.props(rbac.chips)}>
                {properties.data?.map((pr) => {
                  const on = scopeSet.has(pr.id);
                  return <button key={pr.id} type="button" {...stylex.props(rbac.chip, on && rbac.chipOn)} aria-pressed={on} onClick={() => scopeMut.mutate({ pid: pr.id, on })}>{on ? "✓ " : "+ "}{pr.name}</button>;
                })}
              </div>
            </>
          ) : null}
      </section>
    </div>
  );
}

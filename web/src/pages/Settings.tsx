import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Plus } from "../components/icons";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { useAuth } from "../state/AuthContext";
import { createRole, deletePermission, deleteRole, getPermissions, getRoles, setPermission, type RuleInput } from "../services/roles";
import { ApiError } from "../services/http";
import { RbacBuilder } from "../features/rbac/RbacBuilder";
import { AuditLog } from "../features/audit/AuditLog";

// "" = no explicit rule (the role falls back to default-deny / the '*' wildcard).
const LEVELS = ["", "none", "read", "write", "admin"] as const;
const labelFor = (l: string) => (l === "" ? "—" : l);

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "640px" },
  matrixScroll: { overflowX: "auto" }, // many roles → let the matrix scroll rather than break layout
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${colors.line}`, color: colors.ink3, fontWeight: 600, fontSize: "12px", textTransform: "capitalize" },
  thRole: { textAlign: "center" },
  td: { padding: "8px 12px", borderBottom: `1px solid ${colors.line}`, verticalAlign: "middle" },
  tdCell: { textAlign: "center" },
  res: { fontWeight: 500, color: colors.ink },
  field: { fontSize: "11.5px", color: colors.ink3 },
  select: { padding: "5px 8px", borderRadius: "7px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12.5px", cursor: "pointer", minWidth: "72px" },
  locked: { fontSize: "12px", color: colors.ink3, fontStyle: "italic" },
  addRow: { display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", padding: "16px 0 4px" },
  addRowInset: { paddingLeft: "16px", paddingRight: "16px" }, // composed with addRow where the row sits inside a card

  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  fieldLabel: { fontSize: "11px", color: colors.ink3 },
  input: { padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", width: "160px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  rolesCard: { marginBottom: "24px" },
  roleRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderTop: `1px solid ${colors.line}` },
  grow: { flex: 1 },
  roleName: { fontWeight: 600, fontSize: "13px", color: colors.ink },
  roleDesc: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  sysPill: { marginLeft: "8px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: colors.ink3, border: `1px solid ${colors.line}`, borderRadius: radius.sm, padding: "1px 6px" },
  delBtn: { padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.danger, cursor: "pointer", fontSize: "12.5px" },
  err: { fontSize: "12.5px", color: colors.danger, padding: "8px 16px" },
  modeBar: { display: "flex", gap: "4px", padding: "4px", borderRadius: radius.md, backgroundColor: colors.bgSunken, marginBottom: "20px", width: "fit-content" },
  modeTab: { appearance: "none", border: 0, background: "transparent", color: colors.ink3, padding: "7px 14px", borderRadius: radius.sm, fontSize: "13px", fontWeight: 500, cursor: "pointer" },
  modeTabActive: { backgroundColor: colors.bgElev, color: colors.ink },
});

const isRoot = (role: string, resource: string, field: string | null) =>
  role === "principal" && resource === "*" && field == null;

export function Settings() {
  const { token, can } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles", token], queryFn: () => getRoles(token), enabled: can("*", "admin") });
  const perms = useQuery({ queryKey: ["permissions", token], queryFn: () => getPermissions(token), enabled: can("*", "admin") });

  const [mode, setMode] = useState<"builder" | "matrix" | "audit">("builder");
  const [draft, setDraft] = useState({ role: "", resource: "", field: "", level: "read" });
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["permissions"] });
  const invalidateRoles = () => {
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["permissions"] });
  };
  const setMut = useMutation({ mutationFn: (r: RuleInput) => setPermission(token, r), onSuccess: invalidate });
  const delMut = useMutation({
    mutationFn: (r: { role: string; resource: string; field: string | null }) => deletePermission(token, r.role, r.resource, r.field),
    onSuccess: invalidate,
  });
  const createMut = useMutation({
    mutationFn: () => createRole(token, newRole.name.trim(), newRole.description.trim() || null),
    onSuccess: () => { setNewRole({ name: "", description: "" }); invalidateRoles(); },
  });
  const deleteRoleMut = useMutation({ mutationFn: (name: string) => deleteRole(token, name), onSuccess: invalidateRoles });

  // Rows = the distinct (resource, field) pairs across all rules; columns = roles.
  const rows = useMemo(() => {
    const seen = new Map<string, { resource: string; field: string | null }>();
    for (const r of perms.data ?? []) {
      const k = `${r.resource}|${r.field ?? ""}`;
      if (!seen.has(k)) seen.set(k, { resource: r.resource, field: r.field });
    }
    return [...seen.values()].sort((a, b) => a.resource.localeCompare(b.resource) || (a.field ?? "").localeCompare(b.field ?? ""));
  }, [perms.data]);

  const levelAt = (role: string, resource: string, field: string | null) =>
    perms.data?.find((r) => r.role === role && r.resource === resource && (r.field ?? "") === (field ?? ""))?.level ?? "";

  const onCell = (role: string, resource: string, field: string | null, value: string) => {
    if (value === "") delMut.mutate({ role, resource, field });
    else setMut.mutate({ role, resource, field, level: value });
  };

  const addDraft = () => {
    if (!draft.role || !draft.resource.trim()) return;
    setMut.mutate(
      { role: draft.role, resource: draft.resource.trim(), field: draft.field.trim() || null, level: draft.level },
      { onSuccess: () => { invalidate(); setDraft({ role: "", resource: "", field: "", level: "read" }); } },
    );
  };

  if (!can("*", "admin"))
    return (
      <div>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.eyebrow)}>Finance &amp; system · access control</div>
          <h1 {...stylex.props(styles.title)}>Roles &amp; permissions</h1>
        </header>
        <EmptyState title="Administrators only">Only an administrator can manage roles and permissions.</EmptyState>
      </div>
    );

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Finance &amp; system · access control</div>
        <h1 {...stylex.props(styles.title)}>Roles &amp; permissions</h1>
        <p {...stylex.props(styles.desc)}>
          Compose reusable <strong>permission sets</strong> from individual actions, build <strong>roles</strong> (with
          inheritance), nest <strong>teams</strong>, and assign people — then preview exactly what each person can do.
          The server enforces every grant; each change is audited.
        </p>
      </header>

      <div {...stylex.props(styles.modeBar)} role="tablist" aria-label="Access control mode">
        <button type="button" role="tab" aria-selected={mode === "builder"} {...stylex.props(styles.modeTab, mode === "builder" && styles.modeTabActive)} onClick={() => setMode("builder")}>
          Builder
        </button>
        <button type="button" role="tab" aria-selected={mode === "matrix"} {...stylex.props(styles.modeTab, mode === "matrix" && styles.modeTabActive)} onClick={() => setMode("matrix")}>
          Advanced matrix
        </button>
        <button type="button" role="tab" aria-selected={mode === "audit"} {...stylex.props(styles.modeTab, mode === "audit" && styles.modeTabActive)} onClick={() => setMode("audit")}>
          Audit log
        </button>
      </div>

      {mode === "builder" && <RbacBuilder />}
      {mode === "audit" && <AuditLog />}

      {mode === "matrix" && (<>
      <Card style={styles.rolesCard}>
        <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
        {roles.isPending ? <Loading /> : roles.isError ? <ErrorState error={roles.error} /> : (
          <div>
            {roles.data.map((r) => (
              <div key={r.name} {...stylex.props(styles.roleRow)}>
                <div {...stylex.props(styles.grow)}>
                  <span {...stylex.props(styles.roleName)}>{r.name}</span>
                  {r.isSystem && <span {...stylex.props(styles.sysPill)}>system</span>}
                  {r.description && <div {...stylex.props(styles.roleDesc)}>{r.description}</div>}
                </div>
                {!r.isSystem && (
                  <button
                    type="button"
                    {...stylex.props(styles.delBtn)}
                    aria-label={`Delete role ${r.name}`}
                    disabled={deleteRoleMut.isPending}
                    onClick={() => { if (window.confirm(`Delete the "${r.name}" role and its permissions?`)) deleteRoleMut.mutate(r.name); }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
            {deleteRoleMut.isError && (
              <div {...stylex.props(styles.err)} role="alert">
                {deleteRoleMut.error instanceof ApiError ? deleteRoleMut.error.detail : "Couldn't delete the role."}
              </div>
            )}
            <div {...stylex.props(styles.addRow, styles.addRowInset)}>
              <div {...stylex.props(styles.fieldGroup)}>
                <label {...stylex.props(styles.fieldLabel)} htmlFor="new-role-name">New role</label>
                <input id="new-role-name" {...stylex.props(styles.input)} placeholder="e.g. Chef" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              </div>
              <div {...stylex.props(styles.fieldGroup)}>
                <label {...stylex.props(styles.fieldLabel)} htmlFor="new-role-desc">Description (optional)</label>
                <input id="new-role-desc" {...stylex.props(styles.input)} placeholder="what they can do" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              </div>
              <button type="button" {...stylex.props(styles.btn)} disabled={!newRole.name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
                <Plus size={14} /> Add role
              </button>
            </div>
            {createMut.isError && (
              <div {...stylex.props(styles.err)} role="alert">
                {createMut.error instanceof ApiError ? createMut.error.detail : "Couldn't create the role."}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Permission matrix</CardTitle></CardHeader>
        {perms.isPending || roles.isPending ? <Loading />
          : perms.isError ? <ErrorState error={perms.error} />
          : roles.isError ? <ErrorState error={roles.error} />
          : (
            <div {...stylex.props(styles.matrixScroll)}>
            <table {...stylex.props(styles.table)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)} scope="col">Resource</th>
                  {roles.data.map((r) => (
                    <th key={r.name} {...stylex.props(styles.th, styles.thRole)} scope="col" title={r.description ?? undefined}>{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ resource, field }) => (
                  <tr key={`${resource}|${field ?? ""}`}>
                    <th {...stylex.props(styles.td)} scope="row">
                      <span {...stylex.props(styles.res)}>{resource}</span>
                      {field && <span {...stylex.props(styles.field)}> · {field}</span>}
                    </th>
                    {roles.data.map((role) => {
                      const v = levelAt(role.name, resource, field);
                      const locked = isRoot(role.name, resource, field);
                      return (
                        <td key={role.name} {...stylex.props(styles.td, styles.tdCell)}>
                          {locked ? (
                            <span {...stylex.props(styles.locked)} title="The root admin grant is protected">admin 🔒</span>
                          ) : (
                            <select
                              {...stylex.props(styles.select)}
                              aria-label={`${role.name} · ${resource}${field ? ` · ${field}` : ""}`}
                              value={v}
                              onChange={(e) => onCell(role.name, resource, field, e.target.value)}
                            >
                              {LEVELS.map((l) => <option key={l || "none-rule"} value={l}>{labelFor(l)}</option>)}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

        {roles.data && (
          <div {...stylex.props(styles.addRow)}>
            <div {...stylex.props(styles.fieldGroup)}>
              <label {...stylex.props(styles.fieldLabel)} htmlFor="add-role">Role</label>
              <select id="add-role" {...stylex.props(styles.select)} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value="">Choose…</option>
                {roles.data.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div {...stylex.props(styles.fieldGroup)}>
              <label {...stylex.props(styles.fieldLabel)} htmlFor="add-resource">Resource</label>
              <input id="add-resource" {...stylex.props(styles.input)} placeholder="e.g. asset" value={draft.resource} onChange={(e) => setDraft({ ...draft, resource: e.target.value })} />
            </div>
            <div {...stylex.props(styles.fieldGroup)}>
              <label {...stylex.props(styles.fieldLabel)} htmlFor="add-field">Field (optional)</label>
              <input id="add-field" {...stylex.props(styles.input)} placeholder="e.g. market_value" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })} />
            </div>
            <div {...stylex.props(styles.fieldGroup)}>
              <label {...stylex.props(styles.fieldLabel)} htmlFor="add-level">Level</label>
              <select id="add-level" {...stylex.props(styles.select)} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                {["none", "read", "write", "admin"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <button type="button" {...stylex.props(styles.btn)} disabled={!draft.role || !draft.resource.trim() || setMut.isPending} onClick={addDraft}>
              <Plus size={14} /> Add rule
            </button>
          </div>
        )}
      </Card>
      </>)}
    </div>
  );
}

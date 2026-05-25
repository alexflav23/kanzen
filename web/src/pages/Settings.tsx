import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Plus } from "../components/icons";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { useAuth } from "../state/AuthContext";
import { deletePermission, getPermissions, getRoles, setPermission, type RuleInput } from "../services/roles";

// "" = no explicit rule (the role falls back to default-deny / the '*' wildcard).
const LEVELS = ["", "none", "read", "write", "admin"] as const;
const labelFor = (l: string) => (l === "" ? "—" : l);

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "640px" },
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
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  fieldLabel: { fontSize: "11px", color: colors.ink3 },
  input: { padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", width: "160px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

const isRoot = (role: string, resource: string, field: string | null) =>
  role === "principal" && resource === "*" && field == null;

export function Settings() {
  const { token, can } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles", token], queryFn: () => getRoles(token), enabled: can("*", "admin") });
  const perms = useQuery({ queryKey: ["permissions", token], queryFn: () => getPermissions(token), enabled: can("*", "admin") });

  const [draft, setDraft] = useState({ role: "", resource: "", field: "", level: "read" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["permissions"] });
  const setMut = useMutation({ mutationFn: (r: RuleInput) => setPermission(token, r), onSuccess: invalidate });
  const delMut = useMutation({
    mutationFn: (r: { role: string; resource: string; field: string | null }) => deletePermission(token, r.role, r.resource, r.field),
    onSuccess: invalidate,
  });

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
          The matrix the server enforces everywhere. A blank cell (—) means default-deny (the role inherits only the
          <code> *</code> wildcard). Field-level rows override a resource for one attribute. Changes recalibrate each
          person's UI on their next sign-in, and every edit is audited.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Permission matrix</CardTitle></CardHeader>
        {perms.isPending || roles.isPending ? <Loading />
          : perms.isError ? <ErrorState error={perms.error} />
          : roles.isError ? <ErrorState error={roles.error} />
          : (
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
    </div>
  );
}

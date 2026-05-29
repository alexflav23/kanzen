import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Check, Alert, Tasks } from "../components/icons";
import { completePlan, createPlan, listPlans, spawnMaintenanceTask } from "../services/maintenance";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  add: { display: "flex", gap: "8px" },
  input: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", width: "200px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  grow: { flex: 1 },
  name: { fontWeight: 500 },
  sub: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  actions: { display: "flex", alignItems: "center", gap: "8px" },
  complete: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
});

export function Maintenance() {
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [spawned, setSpawned] = useState<Set<string>>(new Set());
  const canManage = role != null && role !== "staff";
  const plans = useQuery({ queryKey: ["maintenance", token], queryFn: () => listPlans(token) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["maintenance"] });
  const add = useMutation({ mutationFn: () => createPlan(title, "annually", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), token), onSuccess: () => { setTitle(""); invalidate(); } });
  const done = useMutation({ mutationFn: (id: string) => completePlan(id, token), onSuccess: invalidate });
  const spawn = useMutation({
    mutationFn: (id: string) => spawnMaintenanceTask(id, token),
    onSuccess: (_r, id) => { setSpawned((s) => new Set(s).add(id)); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · maintenance</div>
          <h1 {...stylex.props(styles.title)}>Maintenance</h1>
          <div {...stylex.props(styles.desc)}>Recurring service plans — completing one rolls its next due date forward.</div>
        </div>
        <div {...stylex.props(styles.add)}>
          <input {...stylex.props(styles.input)} aria-label="New plan" placeholder="New plan (annual)…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" {...stylex.props(styles.btn)} disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> Add</button>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Plans · {plans.data?.length ?? 0}</CardTitle></CardHeader>
        {plans.isPending ? <Loading /> : plans.isError ? <ErrorState error={plans.error} />
          : plans.data.length === 0 ? <EmptyState title="No plans">Add a recurring maintenance plan.</EmptyState>
          : plans.data.map((pl) => (
              <CardRow key={pl.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.name)} data-testid="plan-row">{pl.title ?? "Service"}</div>
                  <div {...stylex.props(styles.sub)}>{pl.frequency}{pl.nextDue ? ` · due ${pl.nextDue.slice(0, 10)}` : ""}{pl.vendor ? ` · ${pl.vendor}` : ""}</div>
                </div>
                <div {...stylex.props(styles.actions)}>
                  {pl.dueSoon && <Pill tone="warn"><Alert size={11} /> due soon</Pill>}
                  {canManage && (spawned.has(pl.id)
                    ? <Pill tone="accent">task created</Pill>
                    : <button type="button" {...stylex.props(styles.complete)} aria-label={`Spawn task for ${pl.title ?? "plan"}`} disabled={spawn.isPending} onClick={() => spawn.mutate(pl.id)}><Tasks size={12} /> Spawn task</button>)}
                  <button type="button" {...stylex.props(styles.complete)} onClick={() => done.mutate(pl.id)}><Check size={12} /> Log service</button>
                </div>
              </CardRow>
            ))}
      </Card>
    </div>
  );
}

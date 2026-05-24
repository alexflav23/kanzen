import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Check } from "../components/icons";
import { completeTask, createTask, listProjects, listTasks } from "../services/tasks";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  add: { display: "flex", gap: "8px" },
  input: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", width: "240px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  grow: { flex: 1 },
  name: { fontWeight: 500 },
  sub: { fontSize: "12px", color: colors.ink3 },
  done: { textDecoration: "line-through", color: colors.ink3 },
  complete: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
});

export function Tasks() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const tasks    = useQuery({ queryKey: ["tasks", token], queryFn: () => listTasks(token) });
  const projects = useQuery({ queryKey: ["task-projects", token], queryFn: () => listProjects(token) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const add = useMutation({ mutationFn: () => createTask(projects.data?.[0]?.id ?? "", title, token), onSuccess: () => { setTitle(""); invalidate(); } });
  const complete = useMutation({ mutationFn: (id: string) => completeTask(id, token), onSuccess: invalidate });

  const canAdd = title.trim().length > 0 && (projects.data?.length ?? 0) > 0;

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · native tasks</div>
          <h1 {...stylex.props(styles.title)}>Tasks</h1>
          <div {...stylex.props(styles.desc)}>Household tasks — recurring chores spawn their next occurrence on completion.</div>
        </div>
        <div {...stylex.props(styles.add)}>
          <input {...stylex.props(styles.input)} aria-label="New task" placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" {...stylex.props(styles.btn)} disabled={!canAdd || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> Add</button>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Tasks · {tasks.data?.length ?? 0}</CardTitle></CardHeader>
        {tasks.isPending ? <Loading /> : tasks.isError ? <ErrorState error={tasks.error} />
          : tasks.data.length === 0 ? <EmptyState title="No tasks">Add a task to get started.</EmptyState>
          : tasks.data.map((t) => (
              <CardRow key={t.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.name, t.status === "done" && styles.done)} data-testid="task-row">{t.title}</div>
                  <div {...stylex.props(styles.sub)}>{[t.dueOn ? `due ${t.dueOn.slice(0, 10)}` : null, t.recurrence].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                {t.recurrence && <Pill tone="accent">{t.recurrence}</Pill>}
                {t.status !== "done"
                  ? <button type="button" {...stylex.props(styles.complete)} onClick={() => complete.mutate(t.id)}><Check size={12} /> Complete</button>
                  : <Pill>done</Pill>}
              </CardRow>
            ))}
      </Card>
    </div>
  );
}

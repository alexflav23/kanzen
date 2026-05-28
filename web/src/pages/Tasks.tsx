import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Check } from "../components/icons";
import { completeTask, createTask, listProjects, listTasks } from "../services/tasks";
import { listPeople } from "../services/people";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const RECURRENCES = ["", "daily", "weekly", "monthly"]; // "" = one-off (matches backend nextDue)

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  grow: { flex: 1 },
  name: { fontWeight: 500 },
  sub: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  done: { textDecoration: "line-through", color: colors.ink3 },
  meta: { display: "flex", alignItems: "center", gap: "8px" },
  complete: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "12.5px", color: colors.ink2 },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
});

function NewTaskModal({ token, projects, people, onClose }: {
  token: string | null;
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const mut = useMutation({
    mutationFn: () => createTask({ projectId, title: title.trim(), dueOn: dueOn || null, recurrence: recurrence || null, assigneeId: assigneeId || null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-task" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (title.trim() && projectId) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New task</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Project</span>
          <select {...stylex.props(styles.control)} aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Title</span>
          <input {...stylex.props(styles.control)} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water the plants" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Assignee (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Due date (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Due date" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Recurrence</span>
          <select {...stylex.props(styles.control)} aria-label="Recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCES.map((r) => <option key={r || "none"} value={r}>{r || "one-off"}</option>)}
          </select></label>
        <div {...stylex.props(styles.label)}>A due date makes the task show on the Calendar (read-only overlay).</div>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!title.trim() || !projectId || mut.isPending}>{mut.isPending ? "Adding…" : "Add task"}</button>
        </div>
      </form>
    </div>
  );
}

export function Tasks() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const tasks = useQuery({ queryKey: ["tasks", token], queryFn: () => listTasks(token) });
  const projects = useQuery({ queryKey: ["task-projects", token], queryFn: () => listProjects(token) });
  const people = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  const peopleById = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p.name])), [people.data]);

  const complete = useMutation({ mutationFn: (id: string) => completeTask(id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const canAdd = (projects.data?.length ?? 0) > 0;

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · native tasks</div>
          <h1 {...stylex.props(styles.title)}>Tasks</h1>
          <div {...stylex.props(styles.desc)}>Household tasks — assign them, set a due date (shows on the Calendar), and recurring chores spawn their next occurrence on completion.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} disabled={!canAdd} onClick={() => setAdding(true)}><Plus size={14} /> New task</button>
      </header>

      {adding && <NewTaskModal token={token} projects={projects.data ?? []} people={people.data ?? []} onClose={() => setAdding(false)} />}

      <Card>
        <CardHeader><CardTitle>Tasks · {tasks.data?.length ?? 0}</CardTitle></CardHeader>
        {tasks.isPending ? <Loading /> : tasks.isError ? <ErrorState error={tasks.error} />
          : tasks.data.length === 0 ? <EmptyState title="No tasks">Add a task to get started.</EmptyState>
          : tasks.data.map((t) => (
              <CardRow key={t.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.name, t.status === "done" && styles.done)} data-testid="task-row">{t.title}</div>
                  <div {...stylex.props(styles.sub)}>{[t.dueOn ? `due ${t.dueOn.slice(0, 10)}` : null, t.recurrence, t.assigneeId ? `· ${peopleById.get(t.assigneeId) ?? "assigned"}` : null].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div {...stylex.props(styles.meta)}>
                  {t.assigneeId && <Pill>{peopleById.get(t.assigneeId) ?? "assigned"}</Pill>}
                  {t.recurrence && <Pill tone="accent">{t.recurrence}</Pill>}
                  {t.status !== "done"
                    ? <button type="button" {...stylex.props(styles.complete)} onClick={() => complete.mutate(t.id)}><Check size={12} /> Complete</button>
                    : <Pill>done</Pill>}
                </div>
              </CardRow>
            ))}
      </Card>
    </div>
  );
}

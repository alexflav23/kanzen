import * as stylex from "@stylexjs/stylex";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { PersonAvatar } from "../components/PersonAvatar";
import { PRIORITIES } from "../components/PriorityPill";
import { Plus, Check, Box, Home, X } from "../components/icons";
import { addTaskLink, completeTask, createTask, deleteTask, listProjects, listTasks, removeTaskLink, updateTask, type Task } from "../services/tasks";
import { listPeople, type Person } from "../services/people";
import { listAssets } from "../services/assets";
import { listProperties } from "../services/properties";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const RECURRENCES = ["", "daily", "weekly", "fortnightly", "monthly", "quarterly"]; // "" = one-off (matches backend nextDue)

// ── date helpers (local, TZ-safe) ─────────────────────────────────────────────
const atMidnight = (iso: string) => new Date(`${iso}T00:00:00`);
const dayDiff = (iso: string) => {
  const t0 = new Date(new Date().toDateString()).getTime();
  return Math.round((atMidnight(iso).getTime() - t0) / 86_400_000);
};
/** Human due label — Today / Tomorrow / Yesterday / weekday within a week / "15 Jun". */
const humanDate = (iso: string) => {
  const d = dayDiff(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d >= -6 && d <= 6) return atMidnight(iso).toLocaleDateString("en-GB", { weekday: "long" });
  return atMidnight(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";
const bucketOf = (iso: string | null): Bucket => {
  if (!iso) return "none";
  const d = dayDiff(iso);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d <= 7) return "week";
  return "later";
};
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No date" },
];
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
// the priority lives in the checkbox ring (Todoist-style), not a pill
const ringColor = (p: string) =>
  p === "urgent" ? colors.danger : p === "high" ? colors.warn : p === "low" ? colors.ink5 : colors.lineStrong;

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", gap: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", maxWidth: "560px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 15px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500, flexShrink: 0 },
  // groups
  group: { padding: "4px 0 6px" },
  groupHead: { display: "flex", alignItems: "baseline", gap: "8px", padding: "16px 18px 8px" },
  groupTitle: { fontSize: "13px", fontWeight: 600, color: colors.ink },
  groupTitleOverdue: { color: colors.danger },
  groupCount: { fontSize: "12px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  // a task row
  row: { display: "flex", alignItems: "flex-start", gap: "12px", padding: "11px 18px", borderTop: `1px solid ${colors.line}` },
  check: { width: "20px", height: "20px", marginTop: "1px", borderRadius: "999px", borderWidth: "2px", borderStyle: "solid", display: "grid", placeItems: "center", cursor: "pointer", backgroundColor: "transparent", padding: 0, flexShrink: 0, color: "transparent", ":hover": { backgroundColor: colors.bgSunken, color: colors.ink3 } },
  checkDone: { color: colors.accentInk, backgroundColor: colors.ink4, borderColor: colors.ink4 },
  grow: { flex: 1, minWidth: 0 },
  // the title is a button — click to edit (Todoist-style); resets button chrome
  taskTitle: { display: "block", textAlign: "left", border: 0, background: "transparent", padding: 0, fontFamily: "inherit", cursor: "pointer", fontSize: "14.5px", color: colors.ink, lineHeight: 1.3, ":hover": { color: colors.accent } },
  taskTitleDone: { textDecoration: "line-through", color: colors.ink4, cursor: "default", ":hover": { color: colors.ink4 } },
  meta: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginTop: "3px", fontSize: "12px", color: colors.ink3 },
  sep: { color: colors.ink5 },
  dateOverdue: { color: colors.danger, fontWeight: 500 },
  dateToday: { color: colors.accent, fontWeight: 500 },
  recur: { color: colors.ink3 },
  // chips for what the task is about (asset / property) — clickable through to the record
  linksRow: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "7px" },
  linkChip: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "999px", backgroundColor: colors.bgSunken, color: colors.ink2, fontSize: "11.5px", textDecoration: "none", maxWidth: "240px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ":hover": { backgroundColor: colors.accentSoft, color: colors.accent } },
  avatarWrap: { marginTop: "1px" },
  // completed section
  doneToggle: { display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", padding: "13px 18px", borderTop: `1px solid ${colors.line}`, background: "transparent", border: 0, cursor: "pointer", fontSize: "13px", color: colors.ink3, fontFamily: "inherit" },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  pickChips: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" },
  pickChip: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 6px 4px 10px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, fontSize: "12px" },
  chipX: { display: "inline-flex", alignItems: "center", border: 0, background: "transparent", cursor: "pointer", color: colors.accent, padding: 0 },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  del: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.danger, cursor: "pointer", fontSize: "13px" },
  ring: (c: string) => ({ borderColor: c }),
});

function TaskModal({ token, projects, people, task, onClose }: {
  token: string | null;
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
  task?: Task; // present = edit mode
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!task;
  const initProp = task?.links.find((l) => l.targetType === "property")?.targetId ?? "";
  const initAssets = (task?.links ?? []).filter((l) => l.targetType === "asset").map((l) => l.targetId);
  const [projectId, setProjectId] = useState(task?.projectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueOn, setDueOn] = useState(task?.dueOn ?? "");
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "normal");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [propertyId, setPropertyId] = useState(initProp);
  const [assetIds, setAssetIds] = useState<string[]>(initAssets);
  const [confirmDel, setConfirmDel] = useState(false);
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const assetsQ = useQuery({ queryKey: ["assets-all", token], queryFn: () => listAssets(token, {}) });
  const assetTitle = (id: string) => (assetsQ.data ?? []).find((a) => a.id === id)?.title ?? id;
  const close = () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); };
  const mut = useMutation({
    mutationFn: async () => {
      const core = { projectId, title: title.trim(), dueOn: dueOn || null, recurrence: recurrence || null, priority, assigneeId: assigneeId || null };
      if (!editing) { await createTask({ ...core, propertyId: propertyId || null, assetIds }, token); return; }
      await updateTask(task!.id, core, token);
      // diff the links and apply (property is single; assets are a set)
      if (initProp !== propertyId) {
        if (initProp) await removeTaskLink(task!.id, "property", initProp, token);
        if (propertyId) await addTaskLink(task!.id, "property", propertyId, token);
      }
      await Promise.all([
        ...initAssets.filter((id) => !assetIds.includes(id)).map((id) => removeTaskLink(task!.id, "asset", id, token)),
        ...assetIds.filter((id) => !initAssets.includes(id)).map((id) => addTaskLink(task!.id, "asset", id, token)),
      ]);
    },
    onSuccess: close,
  });
  const del = useMutation({ mutationFn: () => deleteTask(task!.id, token), onSuccess: close });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid={editing ? "edit-task" : "new-task"} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (title.trim() && projectId) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>{editing ? "Edit task" : "New task"}</div>
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
        <div {...stylex.props(styles.field, styles.twoCol)}>
          <label><span {...stylex.props(styles.label)}>Priority</span>
            <select {...stylex.props(styles.control)} aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></label>
          <label><span {...stylex.props(styles.label)}>Recurrence</span>
            <select {...stylex.props(styles.control)} aria-label="Recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCES.map((r) => <option key={r || "none"} value={r}>{r || "one-off"}</option>)}
            </select></label>
        </div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Related to — property (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Related property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">— no property</option>
            {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.field)}>
          <span {...stylex.props(styles.label)}>Related assets (optional) — e.g. the piece of furniture this is about</span>
          <select {...stylex.props(styles.control)} aria-label="Add related asset" value=""
            onChange={(e) => { const id = e.target.value; if (id) setAssetIds((a) => a.includes(id) ? a : [...a, id]); }}>
            <option value="">+ link an asset…</option>
            {(assetsQ.data ?? []).filter((a) => !assetIds.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          {assetIds.length > 0 && (
            <div {...stylex.props(styles.pickChips)}>
              {assetIds.map((id) => (
                <span key={id} {...stylex.props(styles.pickChip)}>
                  {assetTitle(id)}
                  <button type="button" {...stylex.props(styles.chipX)} aria-label={`Remove ${assetTitle(id)}`} onClick={() => setAssetIds((a) => a.filter((x) => x !== id))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div {...stylex.props(styles.label)}>A due date makes the task show on the Calendar (read-only overlay).</div>
        <div {...stylex.props(styles.actions)}>
          {editing && (
            <button type="button" {...stylex.props(styles.del)} data-testid="delete-task"
              onClick={() => confirmDel ? del.mutate() : setConfirmDel(true)} disabled={del.isPending}>
              {del.isPending ? "Deleting…" : confirmDel ? "Confirm delete" : "Delete"}
            </button>
          )}
          <span {...stylex.props(styles.grow)} />
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!title.trim() || !projectId || mut.isPending}>
            {mut.isPending ? "Saving…" : editing ? "Save changes" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TaskRow({ t, projectName, assignee, assigneeProperty, people, canReassign, onComplete, onEdit, onReassign }: {
  t: Task;
  projectName?: string;
  assignee?: Person;
  assigneeProperty?: string;
  people: { id: string; name: string }[];
  canReassign: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onReassign: (personId: string) => void;
}) {
  const done = t.status === "done";
  const bucket = bucketOf(t.dueOn);
  // meta parts: human date (coloured by urgency), recurrence, project — joined by dot separators
  const parts: ReactNode[] = [];
  if (t.dueOn) {
    const dateStyle = bucket === "overdue" ? styles.dateOverdue : bucket === "today" ? styles.dateToday : null;
    parts.push(<span key="d" {...stylex.props(dateStyle)}>{humanDate(t.dueOn)}</span>);
  }
  if (t.recurrence) parts.push(<span key="r" {...stylex.props(styles.recur)}>↻ {t.recurrence}</span>);
  if (projectName) parts.push(<span key="p">{projectName}</span>);
  return (
    <div {...stylex.props(styles.row)}>
      <button
        type="button"
        {...stylex.props(styles.check, done ? styles.checkDone : styles.ring(ringColor(t.priority)))}
        aria-label={done ? `${t.title} — completed` : `Complete ${t.title} (${t.priority} priority)`}
        disabled={done}
        onClick={onComplete}
      >
        <Check size={12} />
      </button>
      <div {...stylex.props(styles.grow)}>
        <button type="button" {...stylex.props(styles.taskTitle, done && styles.taskTitleDone)} data-testid="task-row" data-priority={t.priority} onClick={onEdit}>{t.title}</button>
        {parts.length > 0 && (
          <div {...stylex.props(styles.meta)}>
            {parts.map((node, i) => (
              <Fragment key={i}>{i > 0 && <span {...stylex.props(styles.sep)} aria-hidden="true">·</span>}{node}</Fragment>
            ))}
          </div>
        )}
        {t.links.length > 0 && (
          <div {...stylex.props(styles.linksRow)} data-testid="task-links">
            {t.links.map((l) => (
              <Link key={`${l.targetType}:${l.targetId}`}
                to={l.targetType === "asset" ? `/inventory/${l.targetId}` : `/properties/${l.targetId}`}
                {...stylex.props(styles.linkChip)} title={l.label}>
                {l.targetType === "asset" ? <Box size={12} /> : <Home size={12} />} {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      {assignee && (
        <span {...stylex.props(styles.avatarWrap)}>
          <PersonAvatar person={assignee} propertyName={assigneeProperty} canReassign={canReassign} people={people} onReassign={onReassign} size={24} />
        </span>
      )}
    </div>
  );
}

export function Tasks() {
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const tasks = useQuery({ queryKey: ["tasks", token], queryFn: () => listTasks(token) });
  const projects = useQuery({ queryKey: ["task-projects", token], queryFn: () => listProjects(token) });
  const people = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  const properties = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const peopleById = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p] as const)), [people.data]);
  const projectById = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const propertyById = useMemo(() => new Map((properties.data ?? []).map((p) => [p.id, p.name])), [properties.data]);
  const peopleOpts = useMemo(() => (people.data ?? []).map((p) => ({ id: p.id, name: p.name })), [people.data]);
  const canReassign = role != null && role !== "staff"; // Manager/Principal can reassign others' work

  const complete = useMutation({ mutationFn: (id: string) => completeTask(id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const reassign = useMutation({
    mutationFn: ({ t, personId }: { t: Task; personId: string }) =>
      updateTask(t.id, { projectId: t.projectId ?? "", title: t.title, dueOn: t.dueOn, recurrence: t.recurrence, priority: t.priority, assigneeId: personId }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const canAdd = (projects.data?.length ?? 0) > 0;

  const all = tasks.data ?? [];
  const active = all.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const completed = all.filter((t) => t.status === "done");
  // bucket the active tasks by due date, sorted within each by priority then due then title
  const grouped = useMemo(() => {
    const m = new Map<Bucket, Task[]>();
    for (const t of active) { const b = bucketOf(t.dueOn); (m.get(b) ?? m.set(b, []).get(b)!).push(t); }
    for (const arr of m.values())
      arr.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
        || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.title.localeCompare(b.title));
    return m;
  }, [active]);

  const row = (t: Task) => {
    const assignee = t.assigneeId ? peopleById.get(t.assigneeId) : undefined;
    return (
      <TaskRow key={t.id} t={t} projectName={t.projectId ? projectById.get(t.projectId) : undefined}
        assignee={assignee} assigneeProperty={assignee?.propertyId ? propertyById.get(assignee.propertyId) : undefined}
        people={peopleOpts} canReassign={canReassign}
        onComplete={() => complete.mutate(t.id)} onEdit={() => setEditing(t)}
        onReassign={(personId) => reassign.mutate({ t, personId })} />
    );
  };

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · native tasks</div>
          <h1 {...stylex.props(styles.title)}>Tasks</h1>
          <div {...stylex.props(styles.desc)}>Assign them, set a priority &amp; due date (shows on the Calendar), and recurring chores spawn their next occurrence on completion.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn)} disabled={!canAdd} onClick={() => setAdding(true)}><Plus size={14} /> New task</button>
      </header>

      {adding && <TaskModal token={token} projects={projects.data ?? []} people={people.data ?? []} onClose={() => setAdding(false)} />}
      {editing && <TaskModal token={token} projects={projects.data ?? []} people={people.data ?? []} task={editing} onClose={() => setEditing(null)} />}

      {tasks.isPending ? <Loading /> : tasks.isError ? <ErrorState error={tasks.error} />
        : active.length === 0 && completed.length === 0 ? <EmptyState title="No tasks">Add a task to get started.</EmptyState>
        : (
          <Card>
            {active.length === 0 && <EmptyState title="All clear">Nothing outstanding — every task is done.</EmptyState>}
            {BUCKETS.map(({ key, label }) => {
              const items = grouped.get(key);
              if (!items || items.length === 0) return null;
              return (
                <div key={key} {...stylex.props(styles.group)} data-testid="task-group">
                  <div {...stylex.props(styles.groupHead)}>
                    <span {...stylex.props(styles.groupTitle, key === "overdue" && styles.groupTitleOverdue)}>{label}</span>
                    <span {...stylex.props(styles.groupCount)}>{items.length}</span>
                  </div>
                  {items.map(row)}
                </div>
              );
            })}
            {completed.length > 0 && (
              <>
                <button type="button" {...stylex.props(styles.doneToggle)} aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
                  <Check size={13} /> {showDone ? "Hide" : "Show"} completed · {completed.length}
                </button>
                {showDone && completed.map(row)}
              </>
            )}
          </Card>
        )}
    </div>
  );
}

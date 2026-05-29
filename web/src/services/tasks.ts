import { z } from "zod";
import { api } from "./http";

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  status: z.string(),
  dueOn: z.string().nullable(),
  recurrence: z.string().nullable(),
  priority: z.string(), // urgent | high | normal | low
  assigneeId: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskReq = { projectId: string; title: string; dueOn: string | null; recurrence: string | null; priority: string; assigneeId: string | null };

export const ProjectSchema = z.object({ id: z.string(), name: z.string(), propertyId: z.string().nullable() });
export type Project = z.infer<typeof ProjectSchema>;

const CompleteSchema = z.object({ completed: z.string(), nextTaskId: z.string().nullable() });

export const listTasks = (token: string | null) => api("/api/tasks", z.array(TaskSchema), { token });
export const listProjects = (token: string | null) => api("/api/task-projects", z.array(ProjectSchema), { token });
export const createTask = (req: CreateTaskReq, token: string | null) =>
  api("/api/tasks", TaskSchema, { method: "POST", body: req, token });
export const completeTask = (id: string, token: string | null) =>
  api(`/api/tasks/${id}/complete`, CompleteSchema, { method: "POST", token });

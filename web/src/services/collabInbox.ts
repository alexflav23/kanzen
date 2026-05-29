import { z } from "zod";
import { api } from "./http";

/** W9 — the collaborative inbox (threads + agent proposals + collaboration). */
export const CInboxSchema = z.object({
  id: z.string(), address: z.string(), label: z.string(), kind: z.string(),
  propertyId: z.string().nullable(), openCount: z.number(),
});
export type CInbox = z.infer<typeof CInboxSchema>;

export const CThreadSchema = z.object({
  id: z.string(), inboxId: z.string(), subject: z.string().nullable(), snippet: z.string().nullable(),
  fromName: z.string().nullable(), lastMessageAt: z.string(), unread: z.boolean(), hasAttachments: z.boolean(),
  status: z.string(), assigneeId: z.string().nullable(), proposalCount: z.number(),
});
export type CThread = z.infer<typeof CThreadSchema>;

export const CMessageSchema = z.object({ id: z.string(), direction: z.string(), fromAddr: z.string().nullable(), sentAt: z.string(), bodyText: z.string().nullable() });
export const CProposalSchema = z.object({ id: z.string(), actionType: z.string(), status: z.string(), title: z.string().nullable(), summary: z.string().nullable(), confidence: z.number().nullable() });
export const CCommentSchema = z.object({ id: z.string(), authorName: z.string().nullable(), body: z.string(), createdAt: z.string() });
export const CThreadDetailSchema = z.object({
  thread: CThreadSchema, messages: z.array(CMessageSchema), proposals: z.array(CProposalSchema), comments: z.array(CCommentSchema),
});
export type CProposal = z.infer<typeof CProposalSchema>;
export type CThreadDetail = z.infer<typeof CThreadDetailSchema>;

export const listInboxes = (token: string | null) => api("/api/inbox/inboxes", z.array(CInboxSchema), { token });
export const listThreads = (token: string | null, q: { inbox?: string; status?: string; assignee?: string } = {}) => {
  const qs = new URLSearchParams();
  if (q.inbox) qs.set("inbox", q.inbox);
  if (q.status) qs.set("status", q.status);
  if (q.assignee) qs.set("assignee", q.assignee);
  return api(`/api/inbox/threads?${qs.toString()}`, z.array(CThreadSchema), { token });
};
export const threadDetail = (id: string, token: string | null) => api(`/api/inbox/threads/${id}`, CThreadDetailSchema, { token });
export const assignThread = (id: string, assigneeId: string | null, token: string | null) =>
  api(`/api/inbox/threads/${id}/assign`, z.unknown(), { method: "POST", body: { assigneeId }, token });
export const setThreadStatus = (id: string, status: string, token: string | null) =>
  api(`/api/inbox/threads/${id}/status`, z.unknown(), { method: "POST", body: { status }, token });
export const addThreadComment = (id: string, body: string, token: string | null) =>
  api(`/api/inbox/threads/${id}/comments`, CCommentSchema, { method: "POST", body: { body, mentions: [] }, token });

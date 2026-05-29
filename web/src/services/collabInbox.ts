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

export const CMessageSchema = z.object({ id: z.string(), direction: z.string(), fromAddr: z.string().nullable(), sentAt: z.string(), bodyText: z.string().nullable(), bodyHtml: z.string().nullable() });
export const CDraftSchema = z.object({ id: z.string(), bodyHtml: z.string(), authorName: z.string().nullable(), updatedAt: z.string() });
export const CProposalSchema = z.object({ id: z.string(), actionType: z.string(), status: z.string(), title: z.string().nullable(), summary: z.string().nullable(), confidence: z.number().nullable() });
export const CCommentSchema = z.object({ id: z.string(), authorName: z.string().nullable(), body: z.string(), createdAt: z.string() });
export const CAttachmentSchema = z.object({ id: z.string(), filename: z.string(), contentType: z.string().nullable(), sizeBytes: z.number().nullable() });
export const CThreadDetailSchema = z.object({
  thread: CThreadSchema, messages: z.array(CMessageSchema), proposals: z.array(CProposalSchema), comments: z.array(CCommentSchema), attachments: z.array(CAttachmentSchema),
  draft: CDraftSchema.nullable(),
});
export const ConfirmResultSchema = z.object({ created: z.string(), recordType: z.string().nullable(), label: z.string().nullable() });

/** W9.4 — the itemised detail behind a proposal, for the review popup. */
export const CProposalLineItemSchema = z.object({ description: z.string(), amountMinor: z.number().nullable(), qty: z.number().nullable() });
export const CProposalLinkSchema = z.object({ targetType: z.string(), label: z.string() });
export const CProposalDetailSchema = z.object({
  id: z.string(), threadId: z.string().nullable(), actionType: z.string(), kind: z.string(), status: z.string(),
  title: z.string().nullable(), summary: z.string().nullable(), confidence: z.number().nullable(), willCreate: z.string(),
  payee: z.string().nullable(), description: z.string().nullable(), currency: z.string().nullable(),
  totalMinor: z.number().nullable(), category: z.string().nullable(), lineItems: z.array(CProposalLineItemSchema),
  date: z.string().nullable(), time: z.string().nullable(), location: z.string().nullable(),
  assignee: z.string().nullable(), priority: z.string().nullable(), listName: z.string().nullable(),
  links: z.array(CProposalLinkSchema),
});
export type CProposalDetail = z.infer<typeof CProposalDetailSchema>;
export type CProposal = z.infer<typeof CProposalSchema>;
export type CThreadDetail = z.infer<typeof CThreadDetailSchema>;

export const listInboxes = (token: string | null) => api("/api/inbox/inboxes", z.array(CInboxSchema), { token });
export const listThreads = (token: string | null, q: { inbox?: string; folder?: string; assignee?: string } = {}) => {
  const qs = new URLSearchParams();
  if (q.inbox) qs.set("inbox", q.inbox);
  if (q.folder) qs.set("folder", q.folder);
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
export const saveDraft = (id: string, bodyHtml: string, token: string | null) =>
  api(`/api/inbox/threads/${id}/draft`, z.unknown(), { method: "POST", body: { bodyHtml }, token });
export const sendReply = (id: string, bodyHtml: string, token: string | null) =>
  api(`/api/inbox/threads/${id}/send`, z.unknown(), { method: "POST", body: { bodyHtml }, token });
export const proposalDetail = (id: string, token: string | null) =>
  api(`/api/inbox/proposals/${id}`, CProposalDetailSchema, { token });
export const confirmProposal = (id: string, token: string | null) =>
  api(`/api/inbox/proposals/${id}/confirm`, ConfirmResultSchema, { method: "POST", token });
export const rejectProposal = (id: string, token: string | null) =>
  api(`/api/inbox/proposals/${id}/reject`, z.unknown(), { method: "POST", token });
/** Back-reference: the email threads linked to a record (asset/expense/calendar). Scope-filtered server-side. */
export const linkedThreads = (targetType: string, targetId: string, token: string | null) =>
  api(`/api/inbox/links?targetType=${targetType}&targetId=${targetId}`, z.array(CThreadSchema), { token });

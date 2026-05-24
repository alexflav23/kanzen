import { z } from "zod";
import { api } from "./http";

/** F34 — an in-app notification (fanned out from a domain event, F02-trimmed). */
export const NotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  channels: z.array(z.string()),
  read: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const InboxSchema = z.object({ unread: z.number(), items: z.array(NotificationSchema) });
export type Inbox = z.infer<typeof InboxSchema>;
const OkSchema = z.object({ ok: z.boolean() });

export const getNotifications = (token: string | null) => api("/api/notifications", InboxSchema, { token });
export const markRead = (id: string, token: string | null) =>
  api(`/api/notifications/${id}/read`, OkSchema, { method: "POST", token });

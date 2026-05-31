import { z } from "zod";
import { api } from "./http";

/** F44 — the tenant's Google Workspace connection. We store only the Secrets-Manager reference (never the key); the
  * live token-exchange is operator-gated. This surface manages the row + validation state through the WorkspaceAuth seam.
  */
export const WorkspaceStatus = z.object({
  connected: z.boolean(),
  domain: z.string().nullable(),
  validated: z.boolean(),
  validationError: z.string().nullable(),
  calendarId: z.string().nullable().optional(),
});
export type WorkspaceStatus = z.infer<typeof WorkspaceStatus>;

export const getWorkspaceStatus = (token: string | null) =>
  api("/api/workspace", WorkspaceStatus, { token });

/** F07 Path B — map a Google calendar for this tenant (push sync target). Requires Workspace connected. */
export const setWorkspaceCalendar = (googleCalendarId: string, token: string | null) =>
  api("/api/workspace/calendar", WorkspaceStatus, { method: "POST", body: { googleCalendarId }, token });

export type ConnectWorkspaceReq = {
  domain: string;
  serviceAccountEmail: string;
  serviceAccountJson: string;
};

export const connectWorkspace = (req: ConnectWorkspaceReq, token: string | null) =>
  api("/api/workspace/connect", WorkspaceStatus, { method: "POST", body: req, token });

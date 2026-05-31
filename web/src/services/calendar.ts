import { z } from "zod";
import { api, API_URL } from "./http";

/** F07 — a merged calendar event (native/Google) or a read-only overlay (task / maintenance). */
export const CalEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startOn: z.string().nullable(),
  // property-local wall-clock "HH:mm[:ss]" (no zone); null = all-day (W6.5)
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  category: z.string(),
  source: z.string(),
  readOnly: z.boolean(),
});
export type CalEvent = z.infer<typeof CalEventSchema>;

/** Merged view over a date window (events + due tasks + maintenance), optionally by category. */
export function listEvents(token: string | null, from: string, to: string, category?: string | null): Promise<CalEvent[]> {
  const qs = new URLSearchParams({ from, to });
  if (category) qs.set("category", category);
  return api(`/api/calendar/events?${qs.toString()}`, z.array(CalEventSchema), { token });
}

export type CreateEventReq = {
  title: string;
  on: string;
  category: string | null;
  propertyId: string | null;
  startTime?: string | null; // "HH:mm" property-local; omit/null = all-day
  endTime?: string | null;
};

/** Create a native calendar event (Manager+). `on` is a YYYY-MM-DD date; times are property-local. */
export function createEvent(token: string | null, req: CreateEventReq): Promise<CalEvent> {
  return api("/api/calendar/events", CalEventSchema, { method: "POST", token, body: req });
}

/** Edit a native calendar event in place. The backend requires title + on + category; times are optional. */
export type UpdateEventReq = {
  title: string;
  on: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
};
export function updateEvent(token: string | null, id: string, req: UpdateEventReq): Promise<unknown> {
  return api(`/api/calendar/events/${id}`, z.unknown(), { method: "PATCH", token, body: req });
}

/** Soft-delete a native calendar event. Read-only overlays (task / maintenance) can't be deleted from here. */
export function deleteEvent(token: string | null, id: string): Promise<unknown> {
  return api(`/api/calendar/events/${id}`, z.unknown(), { method: "DELETE", token });
}

/** F07 iCal — mint this user's signed subscription feed. Returns the absolute https URL plus a `webcal://` variant
  * (which iOS/macOS Calendar open directly into "Add subscription"). The token is the capability — read-only. */
export const FeedUrlSchema = z.object({ path: z.string() });
export async function getCalendarFeed(token: string | null): Promise<{ httpUrl: string; webcalUrl: string }> {
  const { path } = await api("/api/calendar/feed-url", FeedUrlSchema, { token });
  const httpUrl = `${API_URL}${path}`;
  return { httpUrl, webcalUrl: httpUrl.replace(/^https?:\/\//, "webcal://") };
}

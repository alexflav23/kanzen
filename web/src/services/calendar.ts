import { z } from "zod";
import { api } from "./http";

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

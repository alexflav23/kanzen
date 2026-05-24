import { z } from "zod";
import { api } from "./http";

/** F07 — a merged calendar event (native/Google) or a read-only overlay (task / maintenance). */
export const CalEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startOn: z.string().nullable(),
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

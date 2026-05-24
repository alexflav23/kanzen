import { z } from "zod";
import { api } from "./http";

export const PlanSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  frequency: z.string(),
  nextDue: z.string().nullable(),
  vendor: z.string().nullable(),
  dueSoon: z.boolean(),
});
export type Plan = z.infer<typeof PlanSchema>;

const CompleteSchema = z.object({ nextDue: z.string() });

export const listPlans = (token: string | null) => api("/api/maintenance", z.array(PlanSchema), { token });
export const createPlan = (title: string, frequency: string, firstDue: string, token: string | null) =>
  api("/api/maintenance", PlanSchema, { method: "POST", body: { title, propertyId: null, vendor: null, frequency, firstDue, leadDays: 14 }, token });
export const completePlan = (id: string, token: string | null) =>
  api(`/api/maintenance/${id}/complete`, CompleteSchema, { method: "POST", body: { performedOn: null, costMinor: null }, token });

import { z } from "zod";
import { api } from "./http";

/** F10 — a person/HR record (mirrors api.People.PersonView). */
export const PersonSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  role: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  propertyId: z.string().nullable(),
  permitExpiry: z.string().nullable(), // ISO date
  reviewDue: z.string().nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export function listPeople(token: string | null): Promise<Person[]> {
  return api("/api/people", z.array(PersonSchema), { token });
}

// F10 detail (W7.1) — the richer HR record behind a person row.
export const EmergencyContactSchema = z.object({ name: z.string(), relation: z.string().nullable(), phone: z.string().nullable() });
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;
export const PersonDetailSchema = PersonSchema.extend({
  contractType: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  workPermitNo: z.string().nullable(),
  emergencyContacts: z.array(EmergencyContactSchema),
  payrollRef: z.string().nullable(),
  notes: z.string().nullable(),
});
export type PersonDetail = z.infer<typeof PersonDetailSchema>;

export function getPerson(id: string, token: string | null): Promise<PersonDetail> {
  return api(`/api/people/${id}`, PersonDetailSchema, { token });
}

export type CreatePersonReq = {
  name: string;
  role: string | null;
  jurisdiction: string | null;
  propertyId: string | null;
  permitExpiry: string | null;
  reviewDue: string | null;
};

/** Add a household team member (Manager+). */
export function createPerson(req: CreatePersonReq, token: string | null): Promise<Person> {
  return api("/api/people", PersonSchema, { method: "POST", body: { ...req, userId: null }, token });
}

/** Whole days from today until an ISO date (negative if past), or null. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / 86_400_000);
}

import { z } from "zod";
import { api } from "./http";

/** F32 — a natural-language answer (read-only, permission-filtered server-side; Principal-only in v1). */
export const NlItemSchema = z.object({ title: z.string(), subtitle: z.string().nullable() });
export const NlAnswerSchema = z.object({
  prompt: z.string(),
  intent: z.string(),
  answer: z.string(),
  count: z.number().nullable(),
  items: z.array(NlItemSchema).default([]),
});
export type NlAnswer = z.infer<typeof NlAnswerSchema>;

export const nlQuery = (prompt: string, token: string | null) =>
  api("/api/nl/query", NlAnswerSchema, { method: "POST", body: { prompt }, token });

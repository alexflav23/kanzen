import { z } from "zod";
import { api } from "./http";

/** F13 — a parsed receipt/invoice. */
export const ReceiptSchema = z.object({
  id: z.string(),
  kind: z.string(),
  merchant: z.string().nullable(),
  totalMinor: z.number().nullable(),
  currency: z.string().nullable(),
  status: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/** F13/F32 — a receipt line item with brand-normalisation + ML category suggestion. */
export const LineSchema = z.object({
  id: z.string(),
  lineNo: z.number().nullable(),
  description: z.string().nullable(),
  totalMinor: z.number().nullable(),
  currency: z.string().nullable(),
  brandNorm: z.string().nullable(),
  suggestedCategory: z.string().nullable(),
  confirmedCategory: z.string().nullable(),
  status: z.string(),
});
export const ReceiptDetailSchema = z.object({ receipt: ReceiptSchema, lines: z.array(LineSchema) });
export type ReceiptDetail = z.infer<typeof ReceiptDetailSchema>;

export const listReceipts = (token: string | null) => api("/api/receipts", z.array(ReceiptSchema), { token });
export const getReceipt = (token: string | null, id: string) => api(`/api/receipts/${id}`, ReceiptDetailSchema, { token });

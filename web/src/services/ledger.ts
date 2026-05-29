import { z } from "zod";
import { api } from "./http";

// F18/F39 — an account register row: a transaction's effect on one account (a statement line,
// never the raw double-entry postings). Principal-private.
export const RegisterRowSchema = z.object({
  transactionId: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  occurredOn: z.string(),
  amountMinor: z.number(),
  memo: z.string().nullable(),
});
export type RegisterRow = z.infer<typeof RegisterRowSchema>;

export const accountRegister = (accountId: string, token: string | null) =>
  api(`/api/ledger/accounts/${accountId}/register`, z.array(RegisterRowSchema), { token });

import { z } from "zod";
import { api } from "./http";

/** F12 — a financial account (AIS-ingested or CSV-imported; Kanzen never moves money). */
export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  kind: z.string().nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

/** F12/F14 — a bank transaction with its reconciliation state. */
export const TxSchema = z.object({
  id: z.string(),
  providerTxId: z.string().nullable(),
  bookedOn: z.string().nullable(),
  amountMinor: z.number(),
  currency: z.string(),
  direction: z.string(),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
  reconciliationState: z.string(),
});
export type Tx = z.infer<typeof TxSchema>;

export const listAccounts = (token: string | null) => api("/api/bank/accounts", z.array(AccountSchema), { token });
export const listTransactions = (token: string | null, accountId: string) =>
  api(`/api/bank/accounts/${accountId}/transactions`, z.array(TxSchema), { token });

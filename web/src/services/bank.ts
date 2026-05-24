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

/** F14 — auto-suggested reconciliations: per unmatched txn, ranked candidate receipts. */
export const MatchableTxSchema = z.object({
  id: z.string(),
  bookedOn: z.string().nullable(),
  amountMinor: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
});
export const CandidateSchema = z.object({
  receiptId: z.string(),
  merchant: z.string().nullable(),
  totalMinor: z.number(),
  currency: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
});
export const SuggestionSchema = z.object({ txn: MatchableTxSchema, candidates: z.array(CandidateSchema) });
export type Suggestion = z.infer<typeof SuggestionSchema>;
const MatchResultSchema = z.object({ matchId: z.string(), state: z.string() });

export const getSuggestions = (token: string | null, accountId: string) =>
  api(`/api/reconciliation/suggestions?account=${accountId}`, z.array(SuggestionSchema), { token });
export const matchTxn = (token: string | null, txnId: string, receiptId: string) =>
  api("/api/reconciliation/match", MatchResultSchema, { method: "POST", token, body: { txnId, receiptId } });

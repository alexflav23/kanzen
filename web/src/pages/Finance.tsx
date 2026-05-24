import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Check, X } from "../components/icons";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { approveExpense, getDeductibleReport, getIncomeEstimate, listBills, listExpenses, listPayments, markPaid, rejectExpense } from "../services/finance";
import { getSuggestions, listAccounts, listTransactions, matchTxn } from "../services/bank";
import { getReceipt, listReceipts } from "../services/receipts";

type Tab = "bills" | "pay" | "transactions" | "reconcile" | "receipts" | "expenses" | "budgets" | "tax";

const styles = stylex.create({
  header: { marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  tabs: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  bold: { fontWeight: 500 },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  grow: { flex: 1 },
  actions: { display: "flex", gap: "8px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  approve: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  amount: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  note: { padding: "16px 18px", fontSize: "13px", color: colors.ink3 },
  input: { width: "140px", padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink, fontSize: "13.5px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  reconItem: { padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  reconTop: { display: "flex", alignItems: "center", gap: "12px" },
  suggest: { display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", padding: "8px 12px", borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  reasons: { fontSize: "11.5px", color: colors.ink3 },
});

const statusTone = (s: string): "default" | "warn" | "danger" =>
  s === "approved" || s === "paid" ? "default" : s === "rejected" ? "danger" : "warn";

export function Finance() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("bills");

  const bills    = useQuery({ queryKey: ["bills", token], queryFn: () => listBills(token) });
  const payments = useQuery({ queryKey: ["payments", token], queryFn: () => listPayments(token) });
  const pending  = useQuery({ queryKey: ["expenses", "pending_approval", token], queryFn: () => listExpenses(token, "pending_approval") });
  const allExp   = useQuery({ queryKey: ["expenses", "all", token], queryFn: () => listExpenses(token, null) });
  const accounts = useQuery({ queryKey: ["bank", "accounts", token], queryFn: () => listAccounts(token) });
  const [acct, setAcct] = useState<string | null>(null);
  const acctId = acct ?? accounts.data?.[0]?.id ?? null;
  const txns = useQuery({ queryKey: ["bank", "txns", token, acctId], queryFn: () => listTransactions(token, acctId as string), enabled: !!acctId });
  const suggestions = useQuery({ queryKey: ["bank", "suggest", token, acctId], queryFn: () => getSuggestions(token, acctId as string), enabled: !!acctId });
  const confirmMatch = useMutation({
    mutationFn: ({ txnId, receiptId }: { txnId: string; receiptId: string }) => matchTxn(token, txnId, receiptId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank", "suggest"] }); qc.invalidateQueries({ queryKey: ["bank", "txns"] }); },
  });
  const receipts = useQuery({ queryKey: ["receipts", token], queryFn: () => listReceipts(token) });
  const [rcpt, setRcpt] = useState<string | null>(null);
  const rcptId = rcpt ?? receipts.data?.[0]?.id ?? null;
  const receiptDetail = useQuery({ queryKey: ["receipt", token, rcptId], queryFn: () => getReceipt(token, rcptId as string), enabled: !!rcptId });
  const [incomeGbp, setIncomeGbp] = useState(150000); // gross income in whole £ (F38 estimate)
  const deductible = useQuery({ queryKey: ["tax", "deductible", token], queryFn: () => getDeductibleReport(token) });
  const estimate   = useQuery({ queryKey: ["tax", "estimate", token, incomeGbp], queryFn: () => getIncomeEstimate(token, incomeGbp * 100) });

  const invalidateExpenses = () => qc.invalidateQueries({ queryKey: ["expenses"] });
  const approve = useMutation({ mutationFn: (id: string) => approveExpense(id, token), onSuccess: invalidateExpenses });
  const reject  = useMutation({ mutationFn: (id: string) => rejectExpense(id, token), onSuccess: invalidateExpenses });
  const pay     = useMutation({ mutationFn: (id: string) => markPaid(id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }) });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Finance · Principal-private</div>
        <h1 {...stylex.props(styles.title)}>Bills, expenses &amp; approvals</h1>
        <div {...stylex.props(styles.desc)}>{pending.data?.length ?? 0} pending your approval. Kanzen records reality — it never moves money.</div>
      </header>

      <div {...stylex.props(styles.tabs)}>
        {([["bills", "Recurring"], ["pay", "Pay queue"], ["transactions", "Transactions"], ["reconcile", "Reconcile"], ["receipts", "Receipts"], ["expenses", "Expenses"], ["tax", "Tax"], ["budgets", "Budgets"]] as const).map(([t, label]) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} {...stylex.props(styles.tab, tab === t && styles.tabActive)}>{label}</button>
        ))}
      </div>

      {tab === "bills" && (
        <Card>
          <CardHeader><CardTitle>Recurring schedule · {bills.data?.length ?? 0}</CardTitle></CardHeader>
          {bills.isPending ? <Loading /> : bills.isError ? <ErrorState error={bills.error} />
            : bills.data.length === 0 ? <EmptyState title="No bills">Add a recurring bill.</EmptyState>
            : (
              <table {...stylex.props(styles.table)}>
                <thead><tr><th {...stylex.props(styles.th)}>Payee</th><th {...stylex.props(styles.th)}>Status</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th></tr></thead>
                <tbody>
                  {bills.data.map((b) => (
                    <tr key={b.id} data-testid="bill-row">
                      <td {...stylex.props(styles.td, styles.bold)}>{b.payee}</td>
                      <td {...stylex.props(styles.td)}>{b.varianceFlag ? <Pill tone="warn">variance</Pill> : <Pill>steady</Pill>}</td>
                      <td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(b.amountMinor, b.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      )}

      {tab === "pay" && (
        <Card>
          <CardHeader><CardTitle>Pay queue · {payments.data?.length ?? 0}</CardTitle></CardHeader>
          {payments.isPending ? <Loading /> : payments.isError ? <ErrorState error={payments.error} />
            : payments.data.length === 0 ? <EmptyState title="Nothing scheduled" />
            : payments.data.map((p) => (
                <div key={p.id} {...stylex.props(styles.row)} data-testid="pay-row">
                  <span {...stylex.props(styles.amount, styles.grow)}>{fmtMoney(p.amountMinor, p.currency)}</span>
                  <Pill tone={p.mode === "manual" ? "accent" : "default"}>{p.mode}</Pill>
                  <Pill tone={p.state === "paid" ? "default" : "warn"}>{p.state}</Pill>
                  {p.mode === "manual" && p.state !== "paid"
                    ? <button type="button" {...stylex.props(styles.btn)} onClick={() => pay.mutate(p.id)}>Mark paid</button>
                    : <span {...stylex.props(styles.note)}>settles externally</span>}
                </div>
              ))}
        </Card>
      )}

      {tab === "expenses" && (
        <div>
          <Card>
            <CardHeader><CardTitle>Awaiting approval · {pending.data?.length ?? 0}</CardTitle></CardHeader>
            {pending.isPending ? <Loading /> : pending.isError ? <ErrorState error={pending.error} />
              : pending.data.length === 0 ? <div {...stylex.props(styles.note)}>Nothing awaiting approval.</div>
              : pending.data.map((e) => (
                  <div key={e.id} {...stylex.props(styles.row)} data-testid="pending-row">
                    <span {...stylex.props(styles.grow, styles.bold)}>{e.payee ?? "—"}</span>
                    <span {...stylex.props(styles.amount)}>{fmtMoney(e.amountMinor, e.currency)}</span>
                    <div {...stylex.props(styles.actions)}>
                      <button type="button" {...stylex.props(styles.btn, styles.approve)} onClick={() => approve.mutate(e.id)}><Check size={13} /> Approve</button>
                      <button type="button" {...stylex.props(styles.btn)} onClick={() => reject.mutate(e.id)}><X size={13} /> Reject</button>
                    </div>
                  </div>
                ))}
          </Card>
          <div style={{ height: "24px" }} />
          <Card>
            <CardHeader><CardTitle>All expenses · {allExp.data?.length ?? 0}</CardTitle></CardHeader>
            {allExp.isPending ? <Loading /> : allExp.isError ? <ErrorState error={allExp.error} />
              : allExp.data.length === 0 ? <EmptyState title="No expenses" />
              : (
                <table {...stylex.props(styles.table)}>
                  <thead><tr><th {...stylex.props(styles.th)}>Payee</th><th {...stylex.props(styles.th)}>Status</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th></tr></thead>
                  <tbody>
                    {allExp.data.map((e) => (
                      <tr key={e.id} data-testid="expense-row">
                        <td {...stylex.props(styles.td, styles.bold)}>{e.payee ?? "—"}</td>
                        <td {...stylex.props(styles.td)}><Pill tone={statusTone(e.status)}>{e.status.replace("_", " ")}</Pill></td>
                        <td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(e.amountMinor, e.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <div data-testid="transactions-tab">
          {accounts.isPending ? <Loading /> : accounts.isError ? <ErrorState error={accounts.error} />
            : accounts.data.length === 0 ? <EmptyState title="No accounts">Connect a bank or import a statement.</EmptyState>
            : (
              <>
                <div {...stylex.props(styles.tabs)}>
                  {accounts.data.map((a) => (
                    <button key={a.id} type="button" aria-pressed={acctId === a.id} onClick={() => setAcct(a.id)} {...stylex.props(styles.tab, acctId === a.id && styles.tabActive)}>{a.name}</button>
                  ))}
                </div>
                <Card>
                  <CardHeader><CardTitle>Transactions · {txns.data?.length ?? 0}</CardTitle></CardHeader>
                  {txns.isPending ? <Loading /> : txns.isError ? <ErrorState error={txns.error} />
                    : txns.data.length === 0 ? <EmptyState title="No transactions" />
                    : (
                      <table {...stylex.props(styles.table)}>
                        <thead><tr>
                          <th {...stylex.props(styles.th)}>Date</th>
                          <th {...stylex.props(styles.th)}>Description</th>
                          <th {...stylex.props(styles.th)}>State</th>
                          <th {...stylex.props(styles.th, styles.thR)}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {txns.data.map((t) => (
                            <tr key={t.id} data-testid="txn-row">
                              <td {...stylex.props(styles.td)}>{t.bookedOn ?? "—"}</td>
                              <td {...stylex.props(styles.td, styles.bold)}>{t.merchant ?? t.description ?? "—"}</td>
                              <td {...stylex.props(styles.td)}><Pill tone={t.reconciliationState === "reconciled" ? "default" : "warn"}>{t.reconciliationState}</Pill></td>
                              <td {...stylex.props(styles.td, styles.tdR)}>{t.direction === "debit" ? "−" : "+"}{fmtMoney(t.amountMinor, t.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </Card>
              </>
            )}
        </div>
      )}

      {tab === "receipts" && (
        <div data-testid="receipts-tab">
          {receipts.isPending ? <Loading /> : receipts.isError ? <ErrorState error={receipts.error} />
            : receipts.data.length === 0 ? <EmptyState title="No receipts">Captured receipts appear here once parsed.</EmptyState>
            : (
              <>
                <div {...stylex.props(styles.tabs)}>
                  {receipts.data.map((r) => (
                    <button key={r.id} type="button" aria-pressed={rcptId === r.id} onClick={() => setRcpt(r.id)} {...stylex.props(styles.tab, rcptId === r.id && styles.tabActive)}>
                      {r.merchant ?? "Receipt"}
                    </button>
                  ))}
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>{receiptDetail.data?.receipt.merchant ?? "Receipt"} · line items</CardTitle>
                    {receiptDetail.data?.receipt.totalMinor != null && <Pill>{fmtMoney(receiptDetail.data.receipt.totalMinor, receiptDetail.data.receipt.currency ?? "GBP")}</Pill>}
                  </CardHeader>
                  {receiptDetail.isPending ? <Loading /> : receiptDetail.isError ? <ErrorState error={receiptDetail.error} />
                    : receiptDetail.data.lines.length === 0 ? <div {...stylex.props(styles.note)}>No parsed line items for this receipt.</div>
                    : (
                      <table {...stylex.props(styles.table)}>
                        <thead><tr>
                          <th {...stylex.props(styles.th)}>Item</th>
                          <th {...stylex.props(styles.th)}>Brand</th>
                          <th {...stylex.props(styles.th)}>Category</th>
                          <th {...stylex.props(styles.th, styles.thR)}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {receiptDetail.data.lines.map((l) => (
                            <tr key={l.id} data-testid="line-row">
                              <td {...stylex.props(styles.td, styles.bold)}>{l.description ?? "—"}</td>
                              <td {...stylex.props(styles.td)}>{l.brandNorm ?? "—"}</td>
                              <td {...stylex.props(styles.td)}>{(l.confirmedCategory ?? l.suggestedCategory) ? <Pill tone={l.confirmedCategory ? "default" : "accent"}>{l.confirmedCategory ?? l.suggestedCategory}</Pill> : "—"}</td>
                              <td {...stylex.props(styles.td, styles.tdR)}>{l.totalMinor != null ? fmtMoney(l.totalMinor, l.currency ?? "GBP") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </Card>
              </>
            )}
        </div>
      )}

      {tab === "reconcile" && (
        <Card>
          <CardHeader><CardTitle>Auto-suggested reconciliations · {suggestions.data?.length ?? 0} unmatched</CardTitle></CardHeader>
          {suggestions.isPending ? <Loading /> : suggestions.isError ? <ErrorState error={suggestions.error} />
            : suggestions.data.length === 0 ? <EmptyState title="All reconciled">No unmatched transactions.</EmptyState>
            : suggestions.data.map((s) => {
                const c = s.candidates[0];
                return (
                  <div key={s.txn.id} {...stylex.props(styles.reconItem)} data-testid="recon-row">
                    <div {...stylex.props(styles.reconTop)}>
                      <span {...stylex.props(styles.grow, styles.bold)}>{s.txn.merchant ?? s.txn.description ?? "—"}</span>
                      <span {...stylex.props(styles.note)}>{s.txn.bookedOn ?? ""}</span>
                      <span {...stylex.props(styles.amount)}>{fmtMoney(s.txn.amountMinor, s.txn.currency)}</span>
                    </div>
                    {c ? (
                      <div {...stylex.props(styles.suggest)} data-testid="suggestion">
                        <Pill tone="accent">{c.score}% match</Pill>
                        <div {...stylex.props(styles.grow)}>
                          <div {...stylex.props(styles.bold)}>{c.merchant ?? "receipt"} · {fmtMoney(c.totalMinor, c.currency)}</div>
                          <div {...stylex.props(styles.reasons)}>{c.reasons.join(" · ")}</div>
                        </div>
                        <button type="button" {...stylex.props(styles.btn, styles.approve)} onClick={() => confirmMatch.mutate({ txnId: s.txn.id, receiptId: c.receiptId })}>
                          <Check size={13} /> Confirm match
                        </button>
                      </div>
                    ) : <div {...stylex.props(styles.note)}>No suggestion — review and link a receipt manually.</div>}
                  </div>
                );
              })}
        </Card>
      )}

      {tab === "tax" && (
        <div data-testid="tax-tab">
          <Card>
            <CardHeader><CardTitle>UK income-tax estimate</CardTitle><Pill>estimate only</Pill></CardHeader>
            <div {...stylex.props(styles.row)}>
              <label htmlFor="gross" {...stylex.props(styles.grow)}>Gross income (£)</label>
              <input id="gross" type="number" aria-label="Gross income" value={incomeGbp} min={0} step={1000}
                onChange={(e) => setIncomeGbp(Math.max(0, Number(e.target.value) || 0))}
                {...stylex.props(styles.input)} />
            </div>
            {estimate.isPending ? <Loading /> : estimate.isError ? <ErrorState error={estimate.error} /> : (
              <table {...stylex.props(styles.table)} data-testid="estimate">
                <tbody>
                  <tr><td {...stylex.props(styles.td)}>Estimated tax</td><td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(estimate.data.estimatedTaxMinor, "GBP")}</td></tr>
                  <tr><td {...stylex.props(styles.td)}>Take-home</td><td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(estimate.data.takeHomeMinor, "GBP")}</td></tr>
                  <tr><td {...stylex.props(styles.td, styles.bold)}>Effective rate</td><td {...stylex.props(styles.td, styles.tdR)}>{estimate.data.effectiveRatePct}%</td></tr>
                </tbody>
              </table>
            )}
            <div {...stylex.props(styles.note)}>Kanzen never files — this is guidance only.</div>
          </Card>
          <div style={{ height: "24px" }} />
          <Card>
            <CardHeader><CardTitle>Deductible &amp; VAT-reclaimable</CardTitle></CardHeader>
            {deductible.isPending ? <Loading /> : deductible.isError ? <ErrorState error={deductible.error} /> : (
              <table {...stylex.props(styles.table)} data-testid="deductible">
                <tbody>
                  <tr><td {...stylex.props(styles.td)}>Deductible total ({deductible.data.deductibleCount})</td><td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(deductible.data.deductibleTotalMinor, "GBP")}</td></tr>
                  <tr><td {...stylex.props(styles.td)}>VAT reclaimable</td><td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(deductible.data.vatReclaimableTotalMinor, "GBP")}</td></tr>
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "budgets" && (
        <Card><div {...stylex.props(styles.note)}>Per-property budgets arrive with the F17 budgets slice. Approvals + variance are live above.</div></Card>
      )}
    </div>
  );
}

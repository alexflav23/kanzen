import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Check, X, Plus } from "../components/icons";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { approveExpense, createBill, submitExpense, EXPENSE_THRESHOLDS, getDeductibleReport, getIncomeEstimate, listBills, listExpenses, listMethods, createMethod, schedulePayment, listPayments, markPaid, rejectExpense } from "../services/finance";
import { listProperties } from "../services/properties";
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
  spacer24: { height: "24px" },
  input: { width: "140px", padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink, fontSize: "13.5px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  reconItem: { padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  reconTop: { display: "flex", alignItems: "center", gap: "12px" },
  suggest: { display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", padding: "8px 12px", borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  reasons: { fontSize: "11.5px", color: colors.ink3 },
  headBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  catCell: { color: colors.ink3, textTransform: "capitalize" },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  flabel: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  checkRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.ink2, marginBottom: "12px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
});

const statusTone = (s: string): "default" | "warn" | "danger" =>
  s === "approved" || s === "paid" ? "default" : s === "rejected" ? "danger" : "warn";

const BILL_CATEGORIES = ["utilities", "insurance", "services", "subscriptions", "tax", "other"];
const CADENCES = ["monthly", "quarterly", "annually", "weekly"];
const CURRENCIES = ["GBP", "SGD", "USD", "EUR"];

/** F15 — add a recurring bill (Manager+). Money is captured in major units and stored as integer minor. */
function AddBillModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const props = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [payee, setPayee] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState("utilities");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [frequency, setFrequency] = useState("monthly");
  const amountMinor = Math.round((parseFloat(amount) || 0) * 100);
  const mut = useMutation({
    mutationFn: () => createBill({ payee: payee.trim(), propertyId: propertyId || null, category, amountMinor, currency, frequency }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bills"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-bill" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (payee.trim() && amountMinor > 0) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add a bill</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Payee</span>
          <input {...stylex.props(styles.control)} aria-label="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Thames Water" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Category</span>
          <select {...stylex.props(styles.control)} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Property (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">— none</option>
            {(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Amount</span>
          <input {...stylex.props(styles.control)} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 145.00" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Currency</span>
          <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Cadence</span>
          <select {...stylex.props(styles.control)} aria-label="Cadence" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!payee.trim() || amountMinor <= 0 || mut.isPending}>{mut.isPending ? "Adding…" : "Add bill"}</button>
        </div>
      </form>
    </div>
  );
}

/** F17 — submit a manual expense (Manager+). At/over the jurisdiction threshold it routes to the Principal. */
function AddExpenseModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const props = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [deductible, setDeductible] = useState(false);
  const [vatReclaimable, setVatReclaimable] = useState(false);
  const amountMinor = Math.round((parseFloat(amount) || 0) * 100);
  const threshold = EXPENSE_THRESHOLDS[currency];
  const overThreshold = threshold != null ? amountMinor >= threshold : amountMinor > 0; // unknown ccy → safe default
  const mut = useMutation({
    mutationFn: () => submitExpense({ payee: payee.trim() || null, description: description.trim() || null, amountMinor, currency, propertyId: propertyId || null, deductible, vatReclaimable }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-expense" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (amountMinor > 0) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Submit an expense</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Payee</span>
          <input {...stylex.props(styles.control)} aria-label="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Bonhams" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Description (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Property (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">— none</option>
            {(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Amount</span>
          <input {...stylex.props(styles.control)} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1800.00" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Currency</span>
          <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label {...stylex.props(styles.checkRow)}><input type="checkbox" aria-label="Tax-deductible" checked={deductible} onChange={(e) => setDeductible(e.target.checked)} /> <span>Tax-deductible</span></label>
        <label {...stylex.props(styles.checkRow)}><input type="checkbox" aria-label="VAT reclaimable" checked={vatReclaimable} onChange={(e) => setVatReclaimable(e.target.checked)} /> <span>VAT reclaimable</span></label>
        {amountMinor > 0 && (
          <div {...stylex.props(styles.note)} data-testid="approval-hint">
            {overThreshold
              ? `At ${fmtMoney(amountMinor, currency)} this is at or above the ${threshold != null ? fmtMoney(threshold, currency) : "approval"} threshold — it routes to the Principal for approval.`
              : `Below the ${fmtMoney(threshold, currency)} threshold — auto-approved on submit.`}
          </div>
        )}
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={amountMinor <= 0 || mut.isPending}>{mut.isPending ? "Submitting…" : "Submit expense"}</button>
        </div>
      </form>
    </div>
  );
}

const METHOD_TYPES = ["card", "bank_transfer", "direct_debit", "standing_order", "other"];
const PAY_MODES = ["manual", "auto", "review"];

/** F16 — add a payment method. Display only: Kanzen never holds card/bank credentials (the vault is a reference). */
function AddMethodModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState("card");
  const [displayName, setDisplayName] = useState("");
  const [last4, setLast4] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const mut = useMutation({
    mutationFn: () => createMethod({ type, displayName: displayName.trim(), last4: last4.trim() || null, currency, vaultRef: null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["methods"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-method" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (displayName.trim()) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add a payment method</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Type</span>
          <select {...stylex.props(styles.control)} aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {METHOD_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Method name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Coutts current" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Last 4 (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Last 4" value={last4} onChange={(e) => setLast4(e.target.value)} maxLength={4} placeholder="1234" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Currency</span>
          <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <div {...stylex.props(styles.note)}>Display only — Kanzen stores a name + last-4, never the card or bank credentials.</div>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!displayName.trim() || mut.isPending}>{mut.isPending ? "Adding…" : "Add method"}</button>
        </div>
      </form>
    </div>
  );
}

/** F16 — schedule a payment into the Pay queue. Records the intent; never moves money (mark-paid records reality). */
function SchedulePaymentModal({ token, bills, methods, onClose }: { token: string | null; bills: { id: string; payee: string }[]; methods: { id: string; displayName: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [billId, setBillId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [mode, setMode] = useState("manual");
  const amountMinor = Math.round((parseFloat(amount) || 0) * 100);
  const mut = useMutation({
    mutationFn: () => schedulePayment({ billId: billId || null, methodId: methodId || null, amountMinor, currency, mode }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="schedule-payment" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (amountMinor > 0) mut.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Schedule a payment</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Bill (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Bill" value={billId} onChange={(e) => setBillId(e.target.value)}>
            <option value="">— none</option>
            {bills.map((b) => <option key={b.id} value={b.id}>{b.payee}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Method</span>
          <select {...stylex.props(styles.control)} aria-label="Method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">— none</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Amount</span>
          <input {...stylex.props(styles.control)} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 220.00" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Currency</span>
          <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.flabel)}>Mode</span>
          <select {...stylex.props(styles.control)} aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
        <div {...stylex.props(styles.note)}>Only <strong>manual</strong> payments can be marked paid (recording reality); auto/review settle externally. Kanzen never moves money.</div>
        <div {...stylex.props(styles.modalActions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={amountMinor <= 0 || mut.isPending}>{mut.isPending ? "Scheduling…" : "Schedule"}</button>
        </div>
      </form>
    </div>
  );
}

export function Finance() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("bills");
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const bills    = useQuery({ queryKey: ["bills", token], queryFn: () => listBills(token) });
  const payments = useQuery({ queryKey: ["payments", token], queryFn: () => listPayments(token) });
  const methods  = useQuery({ queryKey: ["methods", token], queryFn: () => listMethods(token), enabled: tab === "pay" });
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
          <CardHeader>
            <CardTitle>Recurring schedule · {bills.data?.length ?? 0}</CardTitle>
            <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowAddBill(true)}><Plus size={14} /> Add bill</button>
          </CardHeader>
          {bills.isPending ? <Loading /> : bills.isError ? <ErrorState error={bills.error} />
            : bills.data.length === 0 ? <EmptyState title="No bills">Add a recurring bill.</EmptyState>
            : (
              <table {...stylex.props(styles.table)}>
                <thead><tr><th {...stylex.props(styles.th)}>Payee</th><th {...stylex.props(styles.th)}>Category</th><th {...stylex.props(styles.th)}>Status</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th></tr></thead>
                <tbody>
                  {bills.data.map((b) => (
                    <tr key={b.id} data-testid="bill-row">
                      <td {...stylex.props(styles.td, styles.bold)}>{b.payee}</td>
                      <td {...stylex.props(styles.td, styles.catCell)}>{b.category ?? "—"}</td>
                      <td {...stylex.props(styles.td)}>{b.varianceFlag ? <Pill tone="warn">variance</Pill> : <Pill>steady</Pill>}</td>
                      <td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(b.amountMinor, b.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          {showAddBill && <AddBillModal token={token} onClose={() => setShowAddBill(false)} />}
        </Card>
      )}

      {tab === "pay" && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Payment methods · {methods.data?.length ?? 0}</CardTitle>
              <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowAddMethod(true)}><Plus size={14} /> Add method</button>
            </CardHeader>
            {methods.isPending ? <Loading /> : methods.isError ? <ErrorState error={methods.error} />
              : methods.data.length === 0 ? <div {...stylex.props(styles.note)}>No payment methods yet — add one to schedule against it.</div>
              : methods.data.map((m) => (
                  <div key={m.id} {...stylex.props(styles.row)} data-testid="method-row">
                    <span {...stylex.props(styles.grow, styles.bold)}>{m.displayName}</span>
                    {m.last4 && <span {...stylex.props(styles.note)}>•••• {m.last4}</span>}
                  </div>
                ))}
          </Card>
          <div {...stylex.props(styles.spacer24)} />
          <Card>
            <CardHeader>
              <CardTitle>Pay queue · {payments.data?.length ?? 0}</CardTitle>
              <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowSchedule(true)}><Plus size={14} /> Schedule payment</button>
            </CardHeader>
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
          {showAddMethod && <AddMethodModal token={token} onClose={() => setShowAddMethod(false)} />}
          {showSchedule && <SchedulePaymentModal token={token} bills={(bills.data ?? []).map((b) => ({ id: b.id, payee: b.payee }))} methods={(methods.data ?? []).map((m) => ({ id: m.id, displayName: m.displayName }))} onClose={() => setShowSchedule(false)} />}
        </div>
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
          <div {...stylex.props(styles.spacer24)} />
          <Card>
            <CardHeader>
              <CardTitle>All expenses · {allExp.data?.length ?? 0}</CardTitle>
              <button type="button" {...stylex.props(styles.headBtn)} onClick={() => setShowAddExpense(true)}><Plus size={14} /> Add expense</button>
            </CardHeader>
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
          {showAddExpense && <AddExpenseModal token={token} onClose={() => setShowAddExpense(false)} />}
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
          <div {...stylex.props(styles.spacer24)} />
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

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { EXPENSES, money, type MockExpense } from "../data/mockExpenses";

const styles = stylex.create({
  title: { fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "4px" },
  sub: { color: colors.ink3, marginBottom: "20px" },
  section: { fontSize: "11px", letterSpacing: "0.08em", color: colors.ink3, textTransform: "uppercase", margin: "18px 0 8px" },
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", border: `1px solid ${colors.line}`, borderRadius: radius.md, backgroundColor: colors.bgElev, marginBottom: "8px" },
  grow: { flex: 1 },
  amount: { fontWeight: 600 },
  btn: { padding: "5px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px" },
  approve: { backgroundColor: colors.accent, color: colors.accentInk, borderColor: colors.accent },
  muted: { color: colors.ink3, fontSize: "13px" },
});

export function Finance() {
  const [expenses, setExpenses] = useState<MockExpense[]>(EXPENSES);
  const decide = (id: string, status: "approved" | "rejected") =>
    setExpenses((xs) => xs.map((e) => (e.id === id ? { ...e, status } : e)));

  const pending = expenses.filter((e) => e.status === "pending");

  return (
    <div>
      <h1 {...stylex.props(styles.title)}>Bills, expenses &amp; budgets</h1>
      <p {...stylex.props(styles.sub)}>
        {pending.length} pending your approval.
      </p>

      <div {...stylex.props(styles.section)}>Awaiting your approval</div>
      {pending.length === 0 ? (
        <p {...stylex.props(styles.muted)}>Nothing awaiting approval.</p>
      ) : (
        pending.map((e) => (
          <div key={e.id} data-testid="pending-row" {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.grow)}>
              {e.description} · {e.payee} · {e.property}
            </span>
            <span {...stylex.props(styles.amount)} className="num">
              {money(e.amountMinor, e.currency)}
            </span>
            <button type="button" onClick={() => decide(e.id, "rejected")} {...stylex.props(styles.btn)}>
              Reject
            </button>
            <button type="button" onClick={() => decide(e.id, "approved")} {...stylex.props(styles.btn, styles.approve)}>
              Approve
            </button>
          </div>
        ))
      )}

      <div {...stylex.props(styles.section)}>All expenses</div>
      {expenses.map((e) => (
        <div key={e.id} data-testid="expense-row" {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.grow)}>
            {e.description} · {e.payee}
          </span>
          <span {...stylex.props(styles.muted)}>{e.status}</span>
          <span {...stylex.props(styles.amount)} className="num">
            {money(e.amountMinor, e.currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

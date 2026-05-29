import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { listAccounts, type Account } from "../services/wealth";
import { accountRegister } from "../services/ledger";

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

const styles = stylex.create({
  page: { maxWidth: "1080px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", marginBottom: "24px", maxWidth: "640px" },
  grid: { display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", alignItems: "start" },
  groupLabel: { fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, padding: "12px 16px 4px" },
  acct: { display: "flex", alignItems: "baseline", gap: "8px", width: "100%", textAlign: "left", padding: "9px 16px", border: 0, background: "transparent", cursor: "pointer", borderLeft: `2px solid transparent`, ":hover": { backgroundColor: colors.bgSunken } },
  acctOn: { backgroundColor: colors.bgSunken, borderLeftColor: colors.accent },
  acctName: { flex: 1, minWidth: 0, fontSize: "13.5px", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  acctCode: { fontSize: "11px", color: colors.ink3, fontVariantNumeric: "tabular-nums" },
  acctBal: { fontSize: "13px", color: colors.ink2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "11px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13px" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  date: { color: colors.ink3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  memo: { color: colors.ink3, fontSize: "12px" },
  pos: { color: colors.positive },
  neg: { color: colors.danger },
  hint: { padding: "40px 16px", textAlign: "center", color: colors.ink3, fontSize: "13px" },
});

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const signed = (minor: number, ccy: string) => `${minor < 0 ? "−" : ""}${fmtMoney(Math.abs(minor), ccy)}`;

function Register({ account, token }: { account: Account; token: string | null }) {
  const reg = useQuery({ queryKey: ["ledger-register", account.id, token], queryFn: () => accountRegister(account.id, token) });
  return (
    <Card>
      <CardHeader><CardTitle>{account.code} · {account.name}</CardTitle></CardHeader>
      {reg.isPending ? <Loading /> : reg.isError ? <ErrorState error={reg.error} />
        : reg.data.length === 0 ? <EmptyState title="No entries">This account has no register entries yet.</EmptyState>
        : (
          <table {...stylex.props(styles.table)}>
            <thead><tr>
              <th {...stylex.props(styles.th)}>Date</th><th {...stylex.props(styles.th)}>Entry</th>
              <th {...stylex.props(styles.th, styles.thR)}>Amount</th>
            </tr></thead>
            <tbody>
              {reg.data.map((r) => (
                <tr key={r.transactionId} data-testid="register-row">
                  <td {...stylex.props(styles.td, styles.date)}>{fmtDate(r.occurredOn)}</td>
                  <td {...stylex.props(styles.td)}>
                    {r.description ?? r.kind}
                    {r.memo && <div {...stylex.props(styles.memo)}>{r.memo}</div>}
                  </td>
                  <td {...stylex.props(styles.td, styles.tdR, r.amountMinor < 0 ? styles.neg : styles.pos)}>{signed(r.amountMinor, account.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </Card>
  );
}

/** F18/F39 (W8.3) — Principal-only statements: the chart of accounts with derived balances, and an
 * account's register (transaction-level statement lines). Raw double-entry postings are never shown. */
export function Ledger() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const acctsQ = useQuery({ queryKey: ["ledger-accounts", token], queryFn: () => listAccounts(token, null) });
  const [selected, setSelected] = useState<Account | null>(null);

  const back = <button type="button" onClick={() => navigate("/wealth")} {...stylex.props(styles.back)}>← Wealth</button>;
  const accounts = acctsQ.data ?? [];
  const byType = TYPE_ORDER.map((t) => ({ type: t, rows: accounts.filter((a) => a.accountType === t) })).filter((g) => g.rows.length > 0);
  const active = selected ?? accounts[0] ?? null;

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      <div {...stylex.props(styles.eyebrow)}>Private Wealth · Principal-private</div>
      <h1 {...stylex.props(styles.title)}>Statements</h1>
      <div {...stylex.props(styles.desc)}>The books as statements — every account and its register. Raw postings are never shown; corrections are reversing entries.</div>

      {acctsQ.isPending ? <Loading label="Loading the books…" />
        : acctsQ.isError ? <ErrorState error={acctsQ.error} />
        : accounts.length === 0 ? <EmptyState title="No accounts">The general ledger has no accounts yet.</EmptyState>
        : (
          <div {...stylex.props(styles.grid)}>
            <Card>
              <CardHeader><CardTitle>Chart of accounts · {accounts.length}</CardTitle></CardHeader>
              {byType.map((g) => (
                <div key={g.type}>
                  <div {...stylex.props(styles.groupLabel)}>{g.type}</div>
                  {g.rows.map((a) => (
                    <button key={a.id} type="button" data-testid="account-row"
                      {...stylex.props(styles.acct, active?.id === a.id && styles.acctOn)} onClick={() => setSelected(a)}>
                      <span {...stylex.props(styles.acctCode)}>{a.code}</span>
                      <span {...stylex.props(styles.acctName)}>{a.name}</span>
                      <span {...stylex.props(styles.acctBal)}>{signed(a.balanceMinor, a.currency)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </Card>
            {active ? <Register account={active} token={token} /> : <Card><div {...stylex.props(styles.hint)}>Select an account to see its register.</div></Card>}
          </div>
        )}
    </div>
  );
}

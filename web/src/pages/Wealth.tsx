import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import {
  createSecurity, getBalanceSheet, getIncomeStatement, getNetWorth, listEntities, listHoldings, listSecurities, refreshQuotes,
  recordBuy, recordSell, type BalanceSheet, type Entity, type IncomeStatement, type Security,
} from "../services/wealth";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", marginBottom: "20px" },
  headLinks: { display: "flex", gap: "8px", flexShrink: 0 },
  manage: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px", textDecoration: "none", flexShrink: 0 },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  scope: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px", flexWrap: "wrap" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  hero: { padding: "24px", marginBottom: "20px" },
  net: { fontSize: "40px", fontWeight: 700, letterSpacing: "-0.03em", color: colors.ink, fontVariantNumeric: "tabular-nums" },
  netLabel: { fontSize: "12px", color: colors.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" },
  estimate: { fontSize: "12px", color: colors.ink3, marginTop: "8px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "20px" },
  cell: { padding: "14px 16px", borderRadius: "10px", backgroundColor: colors.bgSunken },
  cellLabel: { fontSize: "11px", color: colors.ink3, textTransform: "uppercase", letterSpacing: "0.05em" },
  cellVal: { fontSize: "20px", fontWeight: 600, color: colors.ink, fontVariantNumeric: "tabular-nums", marginTop: "4px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  bold: { fontWeight: 500 },
  gain: { color: colors.positive },
  loss: { color: colors.danger },
  bsRow: { display: "flex", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${colors.line}`, fontSize: "14px" },
  bsTotal: { fontWeight: 600, color: colors.ink, fontVariantNumeric: "tabular-nums" },
  periodRow: { display: "flex", gap: "6px", marginLeft: "auto" },
  periodBtn: { padding: "5px 10px", borderRadius: "8px", border: `1px solid ${colors.line}`, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12.5px" },
  periodBtnOn: { backgroundColor: colors.accentSoft, color: colors.accent, borderColor: "transparent" },
  exportBtn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 11px", borderRadius: "8px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px", marginLeft: "8px" },
  cardActions: { display: "flex", gap: "8px", marginLeft: "auto" },
  smallBtn: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: "8px", border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  accentBtn: { border: 0, backgroundColor: colors.accent, color: colors.accentInk },
  // trade / security modals
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  seg: { display: "inline-flex", gap: "2px", padding: "3px", borderRadius: radius.md, backgroundColor: colors.bgSunken, marginBottom: "16px" },
  segBtn: { padding: "6px 16px", borderRadius: radius.sm, border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  segOn: { backgroundColor: colors.bgElev, color: colors.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" },
  result: { padding: "16px", borderRadius: radius.md, backgroundColor: colors.bgSunken, fontSize: "14px", color: colors.ink, marginBottom: "16px" },
  resultGain: { fontSize: "22px", fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: "4px" },
  errorText: { color: colors.danger, fontSize: "12.5px", marginBottom: "8px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

const gbp = (m: number) => fmtMoney(m, "GBP");

type Period = "month" | "quarter" | "year";
const PERIODS: { key: Period; label: string }[] = [{ key: "month", label: "This month" }, { key: "quarter", label: "This quarter" }, { key: "year", label: "This year" }];
const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const start =
    p === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : p === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    : new Date(now.getFullYear(), 0, 1);
  return { from: fmtDate(start), to: fmtDate(now) };
}

/** Download the income statement (+ balance sheet) as a CSV — no money moves, it's a report. */
function exportStatementCsv(is: IncomeStatement, bs: BalanceSheet | undefined, entityName: string) {
  const major = (m: number) => (m / 100).toFixed(2);
  const rows: string[][] = [
    ["Kanzen — Income statement"],
    ["Entity", entityName],
    ["From", is.from],
    ["To", is.to],
    [],
    ["Line", "Amount (GBP)"],
    ["Income", major(is.incomeMinor)],
    ["Expenses", major(is.expenseMinor)],
    ["Net", major(is.netMinor)],
  ];
  if (bs) rows.push([], ["Balance sheet"], ["Assets", major(bs.assetsMinor)], ["Liabilities", major(bs.liabilitiesMinor)], ["Equity", major(bs.equityMinor)]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `kanzen-income-statement-${is.from}_${is.to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const toMinor = (v: string) => Math.round((parseFloat(v) || 0) * 100);

/** F40 — record a trade (buy opens a cost-basis lot; sell closes FIFO and shows the realised gain).
 * Records investments; it never executes a trade. Requires a specific entity. */
function RecordTradeModal({ entities, defaultEntity, securities, token, onClose }: { entities: Entity[]; defaultEntity: string | null; securities: Security[]; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [entityId, setEntityId] = useState(defaultEntity ?? entities[0]?.id ?? "");
  const [securityId, setSecurityId] = useState(securities[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [on, setOn] = useState("");
  const [sold, setSold] = useState<number | null>(null);

  const invalidate = () => { for (const k of ["holdings", "net", "bs"]) qc.invalidateQueries({ queryKey: ["wealth", k] }); };
  const trade = useMutation({
    mutationFn: () => {
      const qty = parseFloat(quantity) || 0;
      const minor = toMinor(amount);
      return side === "buy"
        ? recordBuy({ entityId, securityId, quantity: qty, costBasisMinor: minor, acquiredOn: on || null }, token).then(() => null)
        : recordSell({ entityId, securityId, quantity: qty, proceedsMinor: minor, on: on || null }, token).then((r) => r.realizedGainMinor);
    },
    onSuccess: (gain) => { invalidate(); if (side === "sell") setSold(gain); else onClose(); },
  });

  const valid = entityId && securityId && (parseFloat(quantity) || 0) > 0 && toMinor(amount) > 0;
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="trade-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) trade.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Record a trade</div>
        {sold !== null ? (
          <>
            <div {...stylex.props(styles.result)} data-testid="trade-result">
              Sale recorded · realised {sold >= 0 ? "gain" : "loss"}
              <div {...stylex.props(styles.resultGain, sold >= 0 ? styles.gain : styles.loss)}>{sold >= 0 ? "+" : "−"}{gbp(Math.abs(sold))}</div>
            </div>
            <div {...stylex.props(styles.actions)}><button type="button" {...stylex.props(styles.primary)} onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <div {...stylex.props(styles.seg)} role="tablist" aria-label="Trade side">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={side === s} {...stylex.props(styles.segBtn, side === s && styles.segOn)} onClick={() => setSide(s)}>{s === "buy" ? "Buy" : "Sell"}</button>
              ))}
            </div>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Entity</span>
              <select {...stylex.props(styles.control)} aria-label="Entity" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
                {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select></label>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Security</span>
              <select {...stylex.props(styles.control)} aria-label="Security" value={securityId} onChange={(e) => setSecurityId(e.target.value)}>
                {securities.map((s) => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
              </select></label>
            <div {...stylex.props(styles.two)}>
              <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Quantity</span>
                <input {...stylex.props(styles.control)} aria-label="Quantity" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" /></label>
              <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>{side === "buy" ? "Cost (£)" : "Proceeds (£)"}</span>
                <input {...stylex.props(styles.control)} aria-label={side === "buy" ? "Cost" : "Proceeds"} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="900.00" /></label>
            </div>
            <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Date (optional)</span>
              <input {...stylex.props(styles.control)} aria-label="Date" type="date" value={on} onChange={(e) => setOn(e.target.value)} /></label>
            {trade.isError && <div {...stylex.props(styles.errorText)} role="alert">Couldn't record the trade (check quantity available for a sell).</div>}
            <div {...stylex.props(styles.actions)}>
              <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
              <button type="submit" {...stylex.props(styles.primary)} disabled={!valid || trade.isPending}>{trade.isPending ? "Recording…" : side === "buy" ? "Record buy" : "Record sell"}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/** F40 — register a security so it can be traded/held. */
function AddSecurityModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const create = useMutation({
    mutationFn: () => createSecurity({ symbol: symbol.trim(), name: name.trim(), currency, assetClass: null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["securities"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="security-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (symbol.trim() && name.trim()) create.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add a security</div>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Symbol</span>
            <input {...stylex.props(styles.control)} aria-label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. VWRL" autoFocus /></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Currency</span>
            <select {...stylex.props(styles.control)} aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["GBP", "USD", "SGD", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
        </div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vanguard FTSE All-World" /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={!symbol.trim() || !name.trim() || create.isPending}>{create.isPending ? "Adding…" : "Add security"}</button>
        </div>
      </form>
    </div>
  );
}

/** Wave G — Private Wealth: consolidated net worth (F41) + holdings (F40) + balance sheet (F43),
  * per entity (F42) or consolidated. Principal-private (the API hard-403s anyone else). */
export function Wealth() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [entity, setEntity] = useState<string | null>(null); // null = consolidated
  const [period, setPeriod] = useState<Period>("year");
  const { from, to } = periodRange(period);

  const entities = useQuery({ queryKey: ["wealth", "entities", token], queryFn: () => listEntities(token) });
  const net = useQuery({ queryKey: ["wealth", "net", token, entity], queryFn: () => getNetWorth(token, entity) });
  const bs = useQuery({ queryKey: ["wealth", "bs", token, entity], queryFn: () => getBalanceSheet(token, entity) });
  const holdings = useQuery({ queryKey: ["wealth", "holdings", token, entity], queryFn: () => listHoldings(token, entity) });
  const securities = useQuery({ queryKey: ["securities", token], queryFn: () => listSecurities(token) });
  const inc = useQuery({ queryKey: ["wealth", "income", token, entity, from, to], queryFn: () => getIncomeStatement(token, from, to, entity) });
  const entityName = entity === null ? "Consolidated" : entities.data?.find((e) => e.id === entity)?.name ?? "Entity";
  const [trading, setTrading] = useState(false);
  const [addingSec, setAddingSec] = useState(false);
  const canTrade = (entities.data?.length ?? 0) > 0 && (securities.data?.length ?? 0) > 0;
  // F40 — re-quote every security from market data, then revalue holdings + net worth + balance sheet.
  const refreshMut = useMutation({
    mutationFn: () => refreshQuotes(token),
    onSuccess: () => { for (const k of ["holdings", "net", "bs"]) qc.invalidateQueries({ queryKey: ["wealth", k] }); },
  });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Private Wealth · Principal-private</div>
          <h1 {...stylex.props(styles.title)}>Net worth</h1>
          <div {...stylex.props(styles.desc)}>Computed from the ledger — assets and investments at market, less liabilities. The books are never shown; figures only.</div>
        </div>
        <div {...stylex.props(styles.headLinks)}>
          <Link to="/wealth/ledger" {...stylex.props(styles.manage)}>Statements →</Link>
          <Link to="/wealth/entities" {...stylex.props(styles.manage)}>Manage entities →</Link>
        </div>
      </header>

      <div {...stylex.props(styles.scope)}>
        <button type="button" aria-pressed={entity === null} onClick={() => setEntity(null)} {...stylex.props(styles.tab, entity === null && styles.tabActive)}>Consolidated</button>
        {entities.data?.map((e) => (
          <button key={e.id} type="button" aria-pressed={entity === e.id} onClick={() => setEntity(e.id)} {...stylex.props(styles.tab, entity === e.id && styles.tabActive)}>{e.name}</button>
        ))}
      </div>

      <Card style={styles.hero}>
        {net.isPending ? <Loading /> : net.isError ? <ErrorState error={net.error} /> : (
          <div data-testid="net-worth">
            <div {...stylex.props(styles.netLabel)}>{entity === null ? "Consolidated net worth" : "Entity net worth"}</div>
            <div {...stylex.props(styles.net)} data-testid="networth-net">{gbp(net.data.netMinor)}</div>
            <div {...stylex.props(styles.estimate)}>≈ GBP, dated estimate · native figures held per account</div>
            <div {...stylex.props(styles.grid)}>
              <div {...stylex.props(styles.cell)}><div {...stylex.props(styles.cellLabel)}>Cash &amp; other</div><div {...stylex.props(styles.cellVal)}>{gbp(net.data.cashAndOtherMinor)}</div></div>
              <div {...stylex.props(styles.cell)}><div {...stylex.props(styles.cellLabel)}>Investments</div><div {...stylex.props(styles.cellVal)}>{gbp(net.data.investmentsMinor)}</div></div>
              <div {...stylex.props(styles.cell)}><div {...stylex.props(styles.cellLabel)}>Liabilities</div><div {...stylex.props(styles.cellVal)}>{gbp(net.data.liabilitiesMinor)}</div></div>
            </div>
          </div>
        )}
      </Card>

      <Card style={styles.hero}>
        <CardHeader>
          <CardTitle>Income statement</CardTitle>
          <div {...stylex.props(styles.periodRow)}>
            {PERIODS.map((pp) => (
              <button key={pp.key} type="button" aria-pressed={period === pp.key} {...stylex.props(styles.periodBtn, period === pp.key && styles.periodBtnOn)} onClick={() => setPeriod(pp.key)}>{pp.label}</button>
            ))}
            <button type="button" {...stylex.props(styles.exportBtn)} aria-label="Export statement CSV" disabled={!inc.data} onClick={() => inc.data && exportStatementCsv(inc.data, bs.data, entityName)}>Export CSV</button>
          </div>
        </CardHeader>
        {inc.isPending ? <Loading /> : inc.isError ? <ErrorState error={inc.error} /> : (
          <div data-testid="income-statement">
            <div {...stylex.props(styles.bsRow)}><span>Income</span><span {...stylex.props(styles.bsTotal, styles.gain)} data-testid="is-income">{gbp(inc.data.incomeMinor)}</span></div>
            <div {...stylex.props(styles.bsRow)}><span>Expenses</span><span {...stylex.props(styles.bsTotal)}>{gbp(inc.data.expenseMinor)}</span></div>
            <div {...stylex.props(styles.bsRow)}><span {...stylex.props(styles.bold)}>Net</span><span {...stylex.props(styles.bsTotal, inc.data.netMinor >= 0 ? styles.gain : styles.loss)} data-testid="is-net">{inc.data.netMinor >= 0 ? "" : "−"}{gbp(Math.abs(inc.data.netMinor))}</span></div>
          </div>
        )}
      </Card>

      <Card style={styles.hero}>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
          <div {...stylex.props(styles.cardActions)}>
            <button type="button" {...stylex.props(styles.smallBtn)} data-testid="refresh-quotes" disabled={refreshMut.isPending} onClick={() => refreshMut.mutate()}>
              {refreshMut.isPending ? "Refreshing…" : "Refresh quotes"}
            </button>
            <button type="button" {...stylex.props(styles.smallBtn)} onClick={() => setAddingSec(true)}>Add security</button>
            <button type="button" {...stylex.props(styles.smallBtn, styles.accentBtn)} disabled={!canTrade} onClick={() => setTrading(true)}><Plus size={13} /> Record trade</button>
          </div>
        </CardHeader>
        {holdings.isPending ? <Loading /> : holdings.isError ? <ErrorState error={holdings.error} />
          : holdings.data.length === 0 ? <EmptyState title="No holdings">No open positions for this view.</EmptyState>
          : (
            <table {...stylex.props(styles.table)}>
              <thead><tr>
                <th {...stylex.props(styles.th)}>Security</th>
                <th {...stylex.props(styles.th, styles.thR)}>Qty</th>
                <th {...stylex.props(styles.th, styles.thR)}>Cost</th>
                <th {...stylex.props(styles.th, styles.thR)}>Market</th>
                <th {...stylex.props(styles.th, styles.thR)}>Unrealised</th>
              </tr></thead>
              <tbody>
                {holdings.data.map((h) => (
                  <tr key={h.securityId} data-testid="holding-row">
                    <td {...stylex.props(styles.td, styles.bold)}>{h.symbol}</td>
                    <td {...stylex.props(styles.td, styles.tdR)}>{h.quantity}</td>
                    <td {...stylex.props(styles.td, styles.tdR)}>{gbp(h.costBasisMinor)}</td>
                    <td {...stylex.props(styles.td, styles.tdR)}>{gbp(h.marketValueMinor)}</td>
                    <td {...stylex.props(styles.td, styles.tdR, h.unrealizedGainMinor >= 0 ? styles.gain : styles.loss)}>
                      {h.unrealizedGainMinor >= 0 ? "+" : ""}{gbp(h.unrealizedGainMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>

      <Card style={styles.hero}>
        <CardHeader><CardTitle>Balance sheet</CardTitle>{bs.data && (bs.data.balances ? <Pill>balanced</Pill> : <Pill tone="danger">out of balance</Pill>)}</CardHeader>
        {bs.isPending ? <Loading /> : bs.isError ? <ErrorState error={bs.error} /> : (
          <div data-testid="balance-sheet">
            <div {...stylex.props(styles.bsRow)}><span>Assets</span><span {...stylex.props(styles.bsTotal)}>{gbp(bs.data.assetsMinor)}</span></div>
            <div {...stylex.props(styles.bsRow)}><span>Liabilities</span><span {...stylex.props(styles.bsTotal)}>{gbp(bs.data.liabilitiesMinor)}</span></div>
            <div {...stylex.props(styles.bsRow)}><span>Equity</span><span {...stylex.props(styles.bsTotal)}>{gbp(bs.data.equityMinor)}</span></div>
          </div>
        )}
      </Card>

      {trading && <RecordTradeModal entities={entities.data ?? []} defaultEntity={entity} securities={securities.data ?? []} token={token} onClose={() => setTrading(false)} />}
      {addingSec && <AddSecurityModal token={token} onClose={() => setAddingSec(false)} />}
    </div>
  );
}

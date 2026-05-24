import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "../components/Card";
import { Pill } from "../components/Pill";
import { fmtMoney } from "../data/money";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";
import { getBalanceSheet, getNetWorth, listEntities, listHoldings } from "../services/wealth";

const styles = stylex.create({
  header: { marginBottom: "20px" },
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
});

const gbp = (m: number) => fmtMoney(m, "GBP");

/** Wave G — Private Wealth: consolidated net worth (F41) + holdings (F40) + balance sheet (F43),
  * per entity (F42) or consolidated. Principal-private (the API hard-403s anyone else). */
export function Wealth() {
  const { token } = useAuth();
  const [entity, setEntity] = useState<string | null>(null); // null = consolidated

  const entities = useQuery({ queryKey: ["wealth", "entities", token], queryFn: () => listEntities(token) });
  const net = useQuery({ queryKey: ["wealth", "net", token, entity], queryFn: () => getNetWorth(token, entity) });
  const bs = useQuery({ queryKey: ["wealth", "bs", token, entity], queryFn: () => getBalanceSheet(token, entity) });
  const holdings = useQuery({ queryKey: ["wealth", "holdings", token, entity], queryFn: () => listHoldings(token, entity) });

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.eyebrow)}>Private Wealth · Principal-private</div>
        <h1 {...stylex.props(styles.title)}>Net worth</h1>
        <div {...stylex.props(styles.desc)}>Computed from the ledger — assets and investments at market, less liabilities. The books are never shown; figures only.</div>
      </header>

      <div {...stylex.props(styles.scope)} role="tablist">
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
        <CardHeader><CardTitle>Investments</CardTitle></CardHeader>
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
    </div>
  );
}

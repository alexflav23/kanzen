import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Box, Plus } from "../components/icons";
import { PROPERTIES, ROOMS, PROP_DOCS } from "../data/mockProperties";
import { BILLS, fmtDate } from "../data/mockFinance";
import { fmtMoney } from "../data/money";

type Tab = "overview" | "rooms" | "utilities" | "documents";

const styles = stylex.create({
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "14px" },
  cover: { height: "220px", borderRadius: radius.lg, position: "relative", color: "#fff", marginBottom: "24px" },
  coverTop: { position: "absolute", top: "22px", left: "24px", display: "flex", gap: "8px" },
  coverBottom: { position: "absolute", bottom: "26px", left: "28px", right: "28px" },
  coverName: { fontSize: "36px", fontWeight: 600, letterSpacing: "-0.025em" },
  coverAddr: { fontSize: "14px", opacity: 0.82, marginTop: "4px" },
  outlinePill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: radius.sm, fontSize: "12px", color: "#fff", backgroundColor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)" },
  tabs: { display: "flex", gap: "4px", borderBottom: `1px solid ${colors.line}`, marginBottom: "24px" },
  tab: { padding: "10px 14px", border: 0, background: "transparent", cursor: "pointer", fontSize: "13.5px", color: colors.ink3, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  tabActive: { color: colors.ink, borderBottomColor: colors.accent, fontWeight: 500 },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  pad: { padding: "24px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "16px", fontWeight: 600 },
  meta: { display: "grid", gridTemplateColumns: "120px 1fr", rowGap: "10px", fontSize: "13.5px" },
  metaK: { color: colors.ink3 },
  linked: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", backgroundColor: colors.bgSunken, borderRadius: radius.md, marginBottom: "10px" },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", color: colors.ink3 },
  glance: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" },
  glanceCell: { padding: "14px 16px", backgroundColor: colors.bgSunken, borderRadius: radius.md },
  glanceL: { fontSize: "12px", color: colors.ink3 },
  glanceN: { fontSize: "22px", fontWeight: 600, letterSpacing: "-0.018em", marginTop: "4px", fontVariantNumeric: "tabular-nums" },
  full: { gridColumn: "1 / -1" },
  roomIco: { width: "36px", height: "36px", backgroundColor: colors.bgSunken, borderRadius: "10px", display: "grid", placeItems: "center", color: colors.ink2 },
  grow: { flex: 1 },
  sub: { fontSize: "12px", color: colors.ink3 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, padding: "12px 16px", borderBottom: `1px solid ${colors.line}` },
  thR: { textAlign: "right" },
  td: { padding: "12px 16px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  tdR: { textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", fontSize: "13px", color: colors.ink },
  evTitle: { fontSize: "13.5px", fontWeight: 500 },
  f13: { fontSize: "13px" },
  bold: { fontWeight: 500 },
});

export function PropertyBible() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const p = PROPERTIES.find((x) => x.id === id);

  if (!p) {
    return <div><button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.back)}>← All properties</button><p>Property not found.</p></div>;
  }

  const rooms = ROOMS[p.id] ?? [];
  const docs = PROP_DOCS[p.id] ?? [];
  const bills = BILLS.filter((b) => b.property === p.id);

  return (
    <div>
      <button type="button" onClick={() => navigate("/properties")} {...stylex.props(styles.back)}>← All properties</button>

      <div {...stylex.props(styles.cover)} style={{ background: p.cover }}>
        <div {...stylex.props(styles.coverTop)}>
          <span {...stylex.props(styles.outlinePill)}>{p.jurisdiction}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.ownership}</span>
          <span {...stylex.props(styles.outlinePill)}>{p.type}</span>
        </div>
        <div {...stylex.props(styles.coverBottom)}>
          <div {...stylex.props(styles.coverName)}>{p.name}</div>
          <div {...stylex.props(styles.coverAddr)}>{p.address}</div>
        </div>
      </div>

      <div {...stylex.props(styles.tabs)} role="tablist" aria-label="Property sections">
        {(["overview", "rooms", "utilities", "documents"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} {...stylex.props(styles.tab, tab === t && styles.tabActive)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div {...stylex.props(styles.two)}>
          <Card style={styles.pad}>
            <div {...stylex.props(styles.eyebrow)}>Particulars</div>
            <div {...stylex.props(styles.meta)}>
              <span {...stylex.props(styles.metaK)}>Type</span><span>{p.type}</span>
              <span {...stylex.props(styles.metaK)}>Ownership</span><span>{p.ownership}</span>
              <span {...stylex.props(styles.metaK)}>Jurisdiction</span><span>{p.jurisdiction}</span>
              <span {...stylex.props(styles.metaK)}>Building mgmt</span><span>{p.buildingMgmt}</span>
              <span {...stylex.props(styles.metaK)}>Address</span><span>{p.address}</span>
            </div>
          </Card>
          <Card style={styles.pad}>
            <div {...stylex.props(styles.eyebrow)}>Linked systems</div>
            {([
              ["Todoist project", p.linked.todoist, true],
              ["Google Calendar", p.linked.calendar, true],
              ["Drive folder", p.linked.drive, true],
              ["1Password vault", p.linked.vault, false],
            ] as const).map(([label, v, ext]) => (
              <div key={label} {...stylex.props(styles.linked)}>
                <Box size={16} />
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.f13)}>{label}</div>
                  <div {...stylex.props(styles.mono)}>{v}</div>
                </div>
                {ext ? <Pill tone="accent">linked</Pill> : <Pill>reference</Pill>}
              </div>
            ))}
          </Card>
          <Card style={styles.full}>
            <div {...stylex.props(styles.pad)}>
              <div {...stylex.props(styles.eyebrow)}>At a glance</div>
              <div {...stylex.props(styles.glance)}>
                {([["Rooms", p.rooms], ["Assets tracked", p.assets], ["Recurring bills", p.bills], ["Approved vendors", p.vendors], ["Open defects", p.pendingDefects], ["Maintenance plans", 4]] as const).map(([l, v]) => (
                  <div key={l} {...stylex.props(styles.glanceCell)}>
                    <div {...stylex.props(styles.glanceL)}>{l}</div>
                    <div {...stylex.props(styles.glanceN)}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "rooms" && (
        <Card>
          <CardHeader><CardTitle>Rooms · {rooms.length}</CardTitle><button type="button" {...stylex.props(styles.btn)}><Plus size={12} /> Add room</button></CardHeader>
          {rooms.map((r) => (
            <CardRow key={r.id}>
              <div {...stylex.props(styles.roomIco)}><Box size={16} /></div>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.evTitle)}>{r.name}</div>
                <div {...stylex.props(styles.sub)}>Floor {r.floor} · {r.area} · {r.assets} assets</div>
              </div>
            </CardRow>
          ))}
        </Card>
      )}

      {tab === "utilities" && (
        <Card>
          <CardHeader><CardTitle>Recurring bills · {bills.length}</CardTitle></CardHeader>
          <table {...stylex.props(styles.table)}>
            <thead><tr>
              <th {...stylex.props(styles.th)}>Payee</th><th {...stylex.props(styles.th)}>Category</th><th {...stylex.props(styles.th)}>Frequency</th>
              <th {...stylex.props(styles.th)}>Next due</th><th {...stylex.props(styles.th, styles.thR)}>Amount</th>
            </tr></thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td {...stylex.props(styles.td, styles.bold)}>{b.payee}</td>
                  <td {...stylex.props(styles.td)}><Pill>{b.category}</Pill></td>
                  <td {...stylex.props(styles.td)}>{b.freq}</td>
                  <td {...stylex.props(styles.td)}>{fmtDate(b.nextDue)}</td>
                  <td {...stylex.props(styles.td, styles.tdR)}>{fmtMoney(b.amountMinor, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader><CardTitle>Documents · {docs.length}</CardTitle><button type="button" {...stylex.props(styles.btn)}>Open in Drive</button></CardHeader>
          {docs.map((d) => (
            <CardRow key={d.name}>
              <div {...stylex.props(styles.grow)}>
                <div {...stylex.props(styles.evTitle)}>{d.name}</div>
                <div {...stylex.props(styles.sub)}>{d.category} · {d.access}{d.expiry !== "—" && ` · expires ${d.expiry}`}</div>
              </div>
            </CardRow>
          ))}
        </Card>
      )}
    </div>
  );
}

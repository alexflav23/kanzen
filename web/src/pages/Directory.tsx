import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";
import { colors, fonts } from "../styles/tokens.stylex";
import { Card } from "../components/Card";

// F-system — the household's operational directory. Communications config (the agent's operational
// mailboxes + role/property addresses on the household domain); reference info, not data-backed.
const MAILBOXES: [string, string][] = [
  ["Deliveries", "deliveries@kanzen.family"],
  ["Accounts", "accounts@kanzen.family"],
  ["House", "house@kanzen.family"],
  ["Vendors", "vendors@kanzen.family"],
  ["Concierge", "concierge@kanzen.family"],
];
const ROLES: [string, string][] = [
  ["Principal", "flavian@kanzen.family"],
  ["Chief of Staff", "lorna@kanzen.family"],
  ["Wardian", "wardian@kanzen.family"],
  ["Singapore", "singapore@kanzen.family"],
];

const styles = stylex.create({
  page: { maxWidth: "920px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px", marginBottom: "24px", maxWidth: "640px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" },
  pad: { padding: "22px 24px" },
  cardLabel: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, marginBottom: "16px" },
  metaGrid: { display: "grid", gridTemplateColumns: "auto 1fr", rowGap: "12px", columnGap: "18px", alignItems: "baseline" },
  dt: { fontSize: "13px", color: colors.ink2, fontWeight: 500 },
  dd: { fontSize: "13px", color: colors.ink, fontFamily: fonts.mono, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" },
});

/** F-system — Directory: operational mailboxes + role/property addresses (the household domain). */
export function Directory() {
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.eyebrow)}>Communications</div>
      <h1 {...stylex.props(styles.title)}>Directory</h1>
      <div {...stylex.props(styles.desc)}>The household's operational mailboxes (the agent triages these) and role &amp; property addresses on the household domain.</div>

      <div {...stylex.props(styles.grid)}>
        <Card style={styles.pad}>
          <div {...stylex.props(styles.cardLabel)}>Operational mailboxes</div>
          <dl {...stylex.props(styles.metaGrid)}>
            {MAILBOXES.map(([label, addr]) => (
              <Fragment key={addr}>
                <dt {...stylex.props(styles.dt)}>{label}</dt>
                <dd {...stylex.props(styles.dd)} data-testid="dir-address">{addr}</dd>
              </Fragment>
            ))}
          </dl>
        </Card>
        <Card style={styles.pad}>
          <div {...stylex.props(styles.cardLabel)}>Role &amp; property addresses</div>
          <dl {...stylex.props(styles.metaGrid)}>
            {ROLES.map(([label, addr]) => (
              <Fragment key={addr}>
                <dt {...stylex.props(styles.dt)}>{label}</dt>
                <dd {...stylex.props(styles.dd)} data-testid="dir-address">{addr}</dd>
              </Fragment>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

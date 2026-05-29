import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors, fonts } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { Loading, ErrorState } from "../components/states";
import { useAuth } from "../state/AuthContext";
import { listInboxes, type CInbox } from "../services/collabInbox";

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

/** F-system — Directory: the household's mailboxes (the agent triages these). Reads the SAME set the inbox shows
 *  (`/api/inbox/inboxes`), so the rail and the Directory can never drift. */
export function Directory() {
  const { token } = useAuth();
  const q = useQuery({ queryKey: ["inbox-inboxes", token], queryFn: () => listInboxes(token) });
  const boxes = q.data ?? [];
  const shared = boxes.filter((i) => i.kind === "shared");
  const role = boxes.filter((i) => i.kind !== "shared");

  const card = (label: string, items: CInbox[]) => (
    <Card style={styles.pad}>
      <div {...stylex.props(styles.cardLabel)}>{label}</div>
      <dl {...stylex.props(styles.metaGrid)}>
        {items.map((i) => (
          <Fragment key={i.id}>
            <dt {...stylex.props(styles.dt)}>{i.label}</dt>
            <dd {...stylex.props(styles.dd)} data-testid="dir-address">{i.address}</dd>
          </Fragment>
        ))}
      </dl>
    </Card>
  );

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.eyebrow)}>Communications</div>
      <h1 {...stylex.props(styles.title)}>Directory</h1>
      <div {...stylex.props(styles.desc)}>The household's operational mailboxes (the agent triages these) and role &amp; property addresses on the household domain. The Inbox works these same mailboxes.</div>

      {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} /> : (
        <div {...stylex.props(styles.grid)}>
          {card("Operational mailboxes", shared)}
          {card("Role & property addresses", role)}
        </div>
      )}
    </div>
  );
}

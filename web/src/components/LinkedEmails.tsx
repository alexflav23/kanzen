import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle } from "./Card";
import { Pill } from "./Pill";
import { Inbox as InboxIcon } from "./icons";
import { useAuth } from "../state/AuthContext";
import { linkedThreads } from "../services/collabInbox";

/** W9 — the back-reference loop: the email threads linked to this record (asset, expense, calendar event), so a detail
 *  page can answer "what mail concerns this?". Provenance from `entity_links`, scope-filtered server-side. Renders
 *  nothing when there's no linked mail, so it can be dropped onto any detail page. Clicking opens the thread in the inbox.
 */
/** "From · snippet", without repeating the sender when the snippet already leads with it. */
function sub(from: string | null, snippet: string | null): string {
  if (from && snippet) return snippet.startsWith(from) ? snippet : `${from} · ${snippet}`;
  return from ?? snippet ?? "";
}

export function LinkedEmails({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { token } = useAuth();
  const q = useQuery({
    queryKey: ["linkedEmails", targetType, targetId, token],
    queryFn: () => linkedThreads(targetType, targetId, token),
  });

  if (q.isPending || q.isError || (q.data?.length ?? 0) === 0) return null;

  return (
    <div {...stylex.props(styles.section)}>
      <Card>
        <CardHeader>
          <CardTitle>Linked email</CardTitle>
        </CardHeader>
        <div {...stylex.props(styles.list)} data-testid="linked-emails">
          {q.data!.map((t) => (
            <Link key={t.id} to={`/inbox?thread=${t.id}`} {...stylex.props(styles.row)} data-testid="linked-email-row">
              <span {...stylex.props(styles.icon)} aria-hidden="true"><InboxIcon /></span>
              <span {...stylex.props(styles.grow)}>
                <span {...stylex.props(styles.subject)}>{t.subject ?? "(no subject)"}</span>
                <span {...stylex.props(styles.from)}>{sub(t.fromName, t.snippet)}</span>
              </span>
              {t.proposalCount > 0 && <Pill tone="accent">{t.proposalCount} suggested</Pill>}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  section: { marginTop: "24px" },
  list: { display: "flex", flexDirection: "column", gap: 2 },
  row: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: radius.sm,
    textDecoration: "none", color: colors.ink, cursor: "pointer",
    backgroundColor: { default: "transparent", ":hover": colors.bgElev },
  },
  icon: { color: colors.accent, display: "flex", flexShrink: 0 },
  grow: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  subject: { fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  from: { fontSize: 13, color: colors.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

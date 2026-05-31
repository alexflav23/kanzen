import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { verifyEmail } from "../services/tenants";

const styles = stylex.create({
  screen: { minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: colors.bg, padding: "24px" },
  card: { width: "min(440px, 100%)", backgroundColor: colors.bgElev, border: `1px solid ${colors.line}`, borderRadius: radius.lg, padding: "40px 36px", textAlign: "center" },
  mark: { fontSize: "34px", color: colors.accent, marginBottom: "18px", fontWeight: 600 },
  title: { fontSize: "22px", fontWeight: 600, color: colors.ink, marginBottom: "10px", letterSpacing: "-0.01em" },
  body: { fontSize: "14px", color: colors.ink3, lineHeight: 1.55, marginBottom: "24px" },
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 20px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "14px", fontWeight: 500, textDecoration: "none" },
  err: { color: colors.danger },
});

/** F46 — the email-verification landing page. Reads the magic-link token from the URL, confirms it, and points the
 *  freshly-verified principal into setup. Public (no sign-in needed): the token is the capability. Uses TanStack Query
 *  so the request lifecycle (loading/error) is managed and a rejected verify never escapes as an unhandled error. */
export function Verify() {
  const token = new URLSearchParams(window.location.search).get("token");
  const q = useQuery({
    queryKey: ["verify", token],
    queryFn: () => verifyEmail(token!),
    enabled: !!token,
    retry: false,
  });
  const failed = !token || q.isError;

  return (
    <div {...stylex.props(styles.screen)}>
      <div {...stylex.props(styles.card)} data-testid="verify-card">
        <div {...stylex.props(styles.mark)}>完</div>
        {q.isPending && token && (
          <>
            <div {...stylex.props(styles.title)}>Verifying your email…</div>
            <div {...stylex.props(styles.body)}>One moment while we confirm your workspace.</div>
          </>
        )}
        {q.isSuccess && (
          <>
            <div {...stylex.props(styles.title)}>Email verified</div>
            <div {...stylex.props(styles.body)}>
              Your workspace is confirmed. Continue setting things up — next: <strong>{q.data.nextStep ?? "your dashboard"}</strong>.
            </div>
            <a {...stylex.props(styles.btn)} href="/onboard" data-testid="verify-continue">Continue setup</a>
          </>
        )}
        {failed && (
          <>
            <div {...stylex.props(styles.title, styles.err)}>Couldn't verify</div>
            <div {...stylex.props(styles.body)}>
              {token ? "This verification link is invalid or has expired." : "This verification link is missing its token."}
            </div>
            <a {...stylex.props(styles.btn)} href="/" data-testid="verify-home">Back to sign in</a>
          </>
        )}
      </div>
    </div>
  );
}

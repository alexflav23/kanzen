import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { useAuth } from "../state/AuthContext";
import { getSetupState, STEP_LABEL } from "../services/tenants";

const styles = stylex.create({
  banner: {
    display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", marginBottom: "20px",
    borderRadius: radius.md, border: `1px solid ${colors.accent}`, backgroundColor: colors.accentSoft,
  },
  dot: { width: "32px", height: "32px", flexShrink: 0, borderRadius: "999px", backgroundColor: colors.accent, color: colors.accentInk, display: "grid", placeItems: "center", fontSize: "15px", fontWeight: 700 },
  grow: { flex: 1, minWidth: 0 },
  title: { fontSize: "14px", fontWeight: 600, color: colors.ink },
  sub: { fontSize: "13px", color: colors.ink3, marginTop: "2px" },
  cta: { flexShrink: 0, padding: "9px 16px", borderRadius: radius.md, border: 0, backgroundColor: colors.accent, color: colors.accentInk, fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "none" },
});

/** F46 §4 — the first-run "finish setting up" banner. Pinned at the top of the Dashboard until the tenant completes
 *  onboarding (the seeded default tenant is pre-completed, so it never shows). Tells the principal exactly what's next. */
export function SetupBanner() {
  const { token } = useAuth();
  const { data } = useQuery({ queryKey: ["tenant-setup", token], queryFn: () => getSetupState(token) });

  if (!data || data.completed) return null;
  const step = data.currentStep ?? "verify_email";
  const label = STEP_LABEL[step] ?? "Continue setup";

  return (
    <div {...stylex.props(styles.banner)} role="status" data-testid="setup-banner">
      <span {...stylex.props(styles.dot)} aria-hidden>完</span>
      <div {...stylex.props(styles.grow)}>
        <div {...stylex.props(styles.title)}>Welcome to Kanzen — let's finish setting up your household.</div>
        <div {...stylex.props(styles.sub)}>Next step: {label}</div>
      </div>
      <a href="/onboard" {...stylex.props(styles.cta)} data-testid="resume-setup">Resume setup</a>
    </div>
  );
}

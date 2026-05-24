import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { PERSONAS, type Persona } from "../services/auth";
import { useAuth } from "../state/AuthContext";
import { ApiError } from "../services/http";

const styles = stylex.create({
  screen: { minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: colors.bg, color: colors.ink, fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "380px", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "32px 28px" },
  brand: { display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, fontSize: "17px", marginBottom: "4px" },
  mark: { width: "30px", height: "30px", borderRadius: "9px", backgroundColor: colors.ink, color: colors.bgElev, display: "grid", placeItems: "center", fontSize: "16px" },
  sub: { color: colors.ink3, fontSize: "13px", margin: "10px 0 22px" },
  eyebrow: { fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, marginBottom: "10px" },
  persona: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", marginBottom: "8px", borderRadius: radius.md, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", color: colors.ink, fontSize: "14px", textAlign: "left" },
  name: { fontWeight: 600 },
  role: { fontSize: "12px", color: colors.ink3, textTransform: "capitalize" },
  err: { marginTop: "12px", fontSize: "12.5px", color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: "8px 10px" },
  busy: { opacity: 0.6, cursor: "wait" },
});

/** DEV sign-in screen — pick a household persona to mint a local token. The role
  * flows into the backend's default-deny Authorizer, so this also drives RBAC.
  * Replaced by the Cognito hosted-UI redirect when a pool is provisioned. */
export function DevLogin() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (p: Persona) => {
    setBusy(p.email);
    setError(null);
    try {
      await signIn(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Sign-in failed — is the backend running?");
      setBusy(null);
    }
  };

  return (
    <div {...stylex.props(styles.screen)}>
      <div {...stylex.props(styles.card)} data-testid="dev-login">
        <div {...stylex.props(styles.brand)}><span {...stylex.props(styles.mark)}>完</span> Kanzen</div>
        <div {...stylex.props(styles.sub)}>Sign in to the household.</div>
        <div {...stylex.props(styles.eyebrow)}>Dev sign-in · choose a persona</div>
        {PERSONAS.map((p) => (
          <button
            key={p.email}
            type="button"
            disabled={busy !== null}
            onClick={() => onPick(p)}
            {...stylex.props(styles.persona, busy === p.email && styles.busy)}
          >
            <span {...stylex.props(styles.name)}>{p.name}</span>
            <span {...stylex.props(styles.role)}>{busy === p.email ? "Signing in…" : p.role}</span>
          </button>
        ))}
        {error && <div {...stylex.props(styles.err)} role="alert">{error}</div>}
      </div>
    </div>
  );
}

import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { PERSONAS, type Persona } from "../services/auth";
import { useAuth } from "../state/AuthContext";
import { ApiError } from "../services/http";
import { createTenant, slugify } from "../services/tenants";

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
  // ── signup form ──
  field: { marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px", fontWeight: 500 },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: radius.md, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "14px", outline: "none", ":focus": { borderColor: colors.accent } },
  domain: { fontSize: "12px", color: colors.ink3, marginTop: "5px" },
  slugStrong: { color: colors.accent, fontWeight: 600 },
  submit: { width: "100%", padding: "12px 14px", marginTop: "6px", borderRadius: radius.md, border: 0, backgroundColor: colors.accent, color: colors.accentInk, fontSize: "14px", fontWeight: 600, cursor: "pointer", ":disabled": { opacity: 0.6, cursor: "wait" } },
  switch: { marginTop: "18px", paddingTop: "16px", borderTop: `1px solid ${colors.line}`, fontSize: "13px", color: colors.ink3, textAlign: "center" },
  link: { background: "transparent", border: 0, color: colors.accent, cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: 0 },
});

/** DEV sign-in + F46 public workspace signup. Pick a household persona to mint a local token, OR create a brand-new
  * tenant (POST /api/tenants) and land straight in your own clean, isolated household. The role flows into the
  * backend's default-deny Authorizer; Cognito hosted-UI replaces the dev mint when a pool is provisioned. */
export function DevLogin() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // signup form state
  const [workspace, setWorkspace] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const slug = useMemo(() => slugify(workspace), [workspace]);

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

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("signup");
    setError(null);
    try {
      await createTenant({ name: workspace.trim(), slug, principal: { name: adminName.trim(), email: adminEmail.trim() } });
      // land the new principal straight in their fresh, isolated workspace
      await signIn({ name: adminName.trim(), email: adminEmail.trim(), role: "principal" });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create the workspace — is the backend running?");
      setBusy(null);
    }
  };

  const slugValid = slug.length >= 2;
  const canSubmit = workspace.trim().length > 1 && adminName.trim().length > 0 && adminEmail.includes("@") && slugValid;

  return (
    <div {...stylex.props(styles.screen)}>
      <div {...stylex.props(styles.card)} data-testid="dev-login">
        <div {...stylex.props(styles.brand)}><span {...stylex.props(styles.mark)}>完</span> Kanzen</div>

        {mode === "signin" ? (
          <>
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
            <div {...stylex.props(styles.switch)}>
              New here?{" "}
              <button type="button" {...stylex.props(styles.link)} onClick={() => { setMode("signup"); setError(null); }} data-testid="to-signup">
                Create a workspace
              </button>
            </div>
          </>
        ) : (
          <>
            <div {...stylex.props(styles.sub)}>Create your household workspace.</div>
            <form onSubmit={onSignup} data-testid="signup-form">
              <div {...stylex.props(styles.field)}>
                <label htmlFor="ws" {...stylex.props(styles.label)}>Workspace name</label>
                <input id="ws" {...stylex.props(styles.input)} value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="The Carter Household" autoComplete="off" />
                {slug && <div {...stylex.props(styles.domain)}>Your address: <span {...stylex.props(styles.slugStrong)}>{slug}</span>.kanzen.app</div>}
              </div>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="an" {...stylex.props(styles.label)}>Your name</label>
                <input id="an" {...stylex.props(styles.input)} value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Toby Carter" autoComplete="name" />
              </div>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="ae" {...stylex.props(styles.label)}>Your email</label>
                <input id="ae" type="email" {...stylex.props(styles.input)} value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="toby@carter.family" autoComplete="email" />
              </div>
              <button type="submit" disabled={!canSubmit || busy !== null} {...stylex.props(styles.submit)} data-testid="signup-submit">
                {busy === "signup" ? "Creating…" : "Create workspace"}
              </button>
            </form>
            {error && <div {...stylex.props(styles.err)} role="alert">{error}</div>}
            <div {...stylex.props(styles.switch)}>
              Already have a workspace?{" "}
              <button type="button" {...stylex.props(styles.link)} onClick={() => { setMode("signin"); setError(null); }} data-testid="to-signin">
                Sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

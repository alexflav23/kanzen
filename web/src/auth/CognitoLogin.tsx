import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { useAuth } from "../state/AuthContext";
import { signIn, type SignInStep } from "../services/cognito";

const styles = stylex.create({
  screen: { minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: colors.bg, color: colors.ink, fontFamily: "system-ui, -apple-system, sans-serif" },
  card: { width: "380px", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "32px 28px" },
  brand: { display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, fontSize: "17px", marginBottom: "4px" },
  mark: { width: "30px", height: "30px", borderRadius: "9px", backgroundColor: colors.ink, color: colors.bgElev, display: "grid", placeItems: "center", fontSize: "16px" },
  sub: { color: colors.ink3, fontSize: "13px", margin: "10px 0 22px" },
  field: { marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px", fontWeight: 500 },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: radius.md, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "14px", outline: "none", ":focus": { borderColor: colors.accent } },
  submit: { width: "100%", padding: "12px 14px", marginTop: "6px", borderRadius: radius.md, border: 0, backgroundColor: colors.accent, color: colors.accentInk, fontSize: "14px", fontWeight: 600, cursor: "pointer", ":disabled": { opacity: 0.6, cursor: "wait" } },
  err: { marginTop: "12px", fontSize: "12.5px", color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: "8px 10px" },
  hint: { fontSize: "12px", color: colors.ink3, marginTop: "8px" },
});

/** F01 — real Cognito sign-in (prod). Email + password (SRP) → TOTP MFA → (first login) set a new password → the ID
 *  token becomes the app's bearer (`setToken`). The server validates it via HttpJwks and resolves the Kanzen user;
 *  the DB role is authoritative. Shown only when the build is configured for a pool (see App.tsx); dev keeps DevLogin. */
export function CognitoLogin() {
  const { setToken } = useAuth();
  const [step, setStep] = useState<"credentials" | "mfa" | "newPassword">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<((v: string) => Promise<SignInStep>) | null>(null);

  const handle = (s: SignInStep) => {
    switch (s.kind) {
      case "success": setToken(s.idToken); break; // the app takes over (/api/me, etc.)
      case "error": setError(s.message); setBusy(false); break;
      case "mfa": setPending(() => s.submit); setStep("mfa"); setBusy(false); break;
      case "newPassword": setPending(() => s.submit); setStep("newPassword"); setBusy(false); break;
    }
  };

  const onCredentials = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    handle(await signIn(email.trim(), password));
  };
  const onChallenge = (value: string) => async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    if (pending) handle(await pending(value));
  };

  return (
    <div {...stylex.props(styles.screen)}>
      <div {...stylex.props(styles.card)} data-testid="cognito-login">
        <div {...stylex.props(styles.brand)}><span {...stylex.props(styles.mark)}>完</span> Kanzen</div>

        {step === "credentials" && (
          <>
            <div {...stylex.props(styles.sub)}>Sign in to the household.</div>
            <form onSubmit={onCredentials}>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="email" {...stylex.props(styles.label)}>Email</label>
                <input id="email" type="email" autoComplete="username" {...stylex.props(styles.input)} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kanzen.family" />
              </div>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="password" {...stylex.props(styles.label)}>Password</label>
                <input id="password" type="password" autoComplete="current-password" {...stylex.props(styles.input)} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={busy || !email.includes("@") || !password} {...stylex.props(styles.submit)} data-testid="cognito-submit">
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </>
        )}

        {step === "mfa" && (
          <>
            <div {...stylex.props(styles.sub)}>Enter the 6-digit code from your authenticator app.</div>
            <form onSubmit={onChallenge(code.trim())}>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="code" {...stylex.props(styles.label)}>Verification code</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" {...stylex.props(styles.input)} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus />
              </div>
              <button type="submit" disabled={busy || code.trim().length < 6} {...stylex.props(styles.submit)} data-testid="cognito-mfa-submit">
                {busy ? "Verifying…" : "Verify"}
              </button>
            </form>
          </>
        )}

        {step === "newPassword" && (
          <>
            <div {...stylex.props(styles.sub)}>Set a new password to finish setting up your account.</div>
            <form onSubmit={onChallenge(newPassword)}>
              <div {...stylex.props(styles.field)}>
                <label htmlFor="newpw" {...stylex.props(styles.label)}>New password</label>
                <input id="newpw" type="password" autoComplete="new-password" {...stylex.props(styles.input)} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
                <div {...stylex.props(styles.hint)}>At least 12 characters, with upper + lower case, a number and a symbol.</div>
              </div>
              <button type="submit" disabled={busy || newPassword.length < 12} {...stylex.props(styles.submit)} data-testid="cognito-newpw-submit">
                {busy ? "Saving…" : "Set password & sign in"}
              </button>
            </form>
          </>
        )}

        {error && <div {...stylex.props(styles.err)} role="alert">{error}</div>}
      </div>
    </div>
  );
}

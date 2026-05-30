import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { useAuth } from "../state/AuthContext";
import { getSetupState, advanceSetup, STEP_ORDER, STEP_LABEL } from "../services/tenants";
import { createProperty } from "../services/properties";
import { Check } from "../components/icons";

const styles = stylex.create({
  screen: { minHeight: "calc(100vh - 0px)", display: "grid", placeItems: "center", padding: "40px 20px" },
  card: { width: "560px", maxWidth: "100%", border: `1px solid ${colors.line}`, borderRadius: radius.lg, backgroundColor: colors.bgElev, padding: "32px 32px 28px", boxShadow: colors.shadow2 },
  brand: { display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, fontSize: "16px", marginBottom: "20px" },
  mark: { width: "28px", height: "28px", borderRadius: "8px", backgroundColor: colors.ink, color: colors.bgElev, display: "grid", placeItems: "center", fontSize: "15px" },
  strip: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "26px", flexWrap: "wrap" },
  pip: { display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: colors.ink3, padding: "5px 10px", borderRadius: "999px", border: `1px solid ${colors.line}` },
  pipDone: { color: colors.accent, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pipNow: { color: colors.ink, borderColor: colors.ink3, fontWeight: 600 },
  tick: { width: "16px", height: "16px", borderRadius: "999px", backgroundColor: colors.accent, color: colors.accentInk, display: "grid", placeItems: "center" },
  num: { width: "16px", height: "16px", borderRadius: "999px", border: `1px solid currentColor`, display: "grid", placeItems: "center", fontSize: "10px", fontWeight: 700 },
  h: { fontSize: "22px", fontWeight: 700, color: colors.ink, marginBottom: "6px", letterSpacing: "-0.01em" },
  p: { fontSize: "14px", color: colors.ink3, lineHeight: 1.5, marginBottom: "22px" },
  field: { marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px", fontWeight: 500 },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: radius.md, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "14px", outline: "none", ":focus": { borderColor: colors.accent } },
  row: { display: "flex", gap: "12px" },
  grow: { flex: 1 },
  actions: { display: "flex", alignItems: "center", gap: "12px", marginTop: "26px", paddingTop: "20px", borderTop: `1px solid ${colors.line}` },
  primary: { padding: "11px 20px", borderRadius: radius.md, border: 0, backgroundColor: colors.accent, color: colors.accentInk, fontSize: "14px", fontWeight: 600, cursor: "pointer", ":disabled": { opacity: 0.6, cursor: "wait" } },
  skip: { background: "transparent", border: 0, color: colors.ink3, fontSize: "13px", cursor: "pointer", textDecoration: "underline", marginLeft: "auto" },
  note: { fontSize: "12.5px", color: colors.ink3, backgroundColor: colors.bgSunken, borderRadius: radius.md, padding: "12px 14px", marginBottom: "20px" },
  err: { marginTop: "12px", fontSize: "12.5px", color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: "8px 10px" },
});

/** F46 — the first-run onboarding wizard. Reads tenant_setup.current_step to land on the right step; each step's
 *  "Save & continue" / "Skip" advances the state machine. Steps gated on operator infra (Workspace, F44) are presented
 *  but skippable. Finishing the tour marks onboarding complete and drops the Dashboard banner. */
export function Onboard() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-setup", token], queryFn: () => getSetupState(token) });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // first_property form
  const [propName, setPropName] = useState("");
  const [propAddr, setPropAddr] = useState("");
  const [country, setCountry] = useState("uk");

  if (isLoading) return <div {...stylex.props(styles.screen)} data-testid="onboard">Loading…</div>;
  if (data?.completed) {
    // already done — bounce to the dashboard
    return (
      <div {...stylex.props(styles.screen)} data-testid="onboard">
        <div {...stylex.props(styles.card)}>
          <div {...stylex.props(styles.h)}>You're all set 🎉</div>
          <div {...stylex.props(styles.p)}>Your household is ready.</div>
          <button type="button" {...stylex.props(styles.primary)} onClick={() => navigate("/")} data-testid="to-dashboard">Go to dashboard</button>
        </div>
      </div>
    );
  }

  const step = data?.currentStep ?? "verify_email";
  const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tenant-setup"] });
  const next = async (s: string, before?: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      if (before) await before();
      const st = await advanceSetup(s, token);
      refresh();
      if (st.completed) navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const CURRENCY: Record<string, string> = { uk: "GBP", sg: "SGD", us: "USD" };

  return (
    <div {...stylex.props(styles.screen)} data-testid="onboard">
      <div {...stylex.props(styles.card)}>
        <div {...stylex.props(styles.brand)}><span {...stylex.props(styles.mark)}>完</span> Set up your household</div>

        <div {...stylex.props(styles.strip)} aria-label="Setup progress">
          {STEP_ORDER.map((s, i) => (
            <span key={s} {...stylex.props(styles.pip, i < idx && styles.pipDone, i === idx && styles.pipNow)}>
              {i < idx ? <span {...stylex.props(styles.tick)}><Check size={10} /></span> : <span {...stylex.props(styles.num)}>{i + 1}</span>}
              {STEP_LABEL[s]?.split(" ")[0] ?? s}
            </span>
          ))}
        </div>

        {step === "verify_email" && (
          <>
            <div {...stylex.props(styles.h)}>Verify your email</div>
            <div {...stylex.props(styles.p)}>We've sent a magic link to your inbox. In this sandbox you can confirm straight away.</div>
            <div {...stylex.props(styles.actions)}>
              <button type="button" disabled={busy} {...stylex.props(styles.primary)} onClick={() => next("verify_email")} data-testid="step-primary">I've verified my email</button>
            </div>
          </>
        )}

        {step === "workspace" && (
          <>
            <div {...stylex.props(styles.h)}>Connect Google Workspace</div>
            <div {...stylex.props(styles.p)}>Kanzen reads forwarded mail + provisions your operational mailboxes through your Workspace domain. You can connect this later from Settings → Integrations.</div>
            <div {...stylex.props(styles.note)}>Requires a Workspace super-admin to authorise the service account — skip for now and the Dashboard will remind you.</div>
            <div {...stylex.props(styles.actions)}>
              <button type="button" disabled={busy} {...stylex.props(styles.primary)} onClick={() => next("workspace")} data-testid="step-primary">Connect later</button>
              <button type="button" {...stylex.props(styles.skip)} onClick={() => next("workspace")} data-testid="step-skip">Skip</button>
            </div>
          </>
        )}

        {step === "first_property" && (
          <>
            <div {...stylex.props(styles.h)}>Add your first property</div>
            <div {...stylex.props(styles.p)}>Everything in Kanzen lives somewhere — a home, an apartment, an office. Add your main one to start.</div>
            <div {...stylex.props(styles.field)}>
              <label htmlFor="pn" {...stylex.props(styles.label)}>Property name</label>
              <input id="pn" {...stylex.props(styles.input)} value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="Wardian — Apt 5206" />
            </div>
            <div {...stylex.props(styles.field)}>
              <label htmlFor="pa" {...stylex.props(styles.label)}>Address</label>
              <input id="pa" {...stylex.props(styles.input)} value={propAddr} onChange={(e) => setPropAddr(e.target.value)} placeholder="Wardian, London E14" />
            </div>
            <div {...stylex.props(styles.field)}>
              <label htmlFor="pc" {...stylex.props(styles.label)}>Country</label>
              <select id="pc" {...stylex.props(styles.input)} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="uk">United Kingdom (GBP)</option>
                <option value="sg">Singapore (SGD)</option>
                <option value="us">United States (USD)</option>
              </select>
            </div>
            <div {...stylex.props(styles.actions)}>
              <button
                type="button"
                disabled={busy || propName.trim().length < 2}
                {...stylex.props(styles.primary)}
                data-testid="step-primary"
                onClick={() => next("first_property", async () => {
                  await createProperty({ name: propName.trim(), address: propAddr.trim() || null, jurisdiction: country, propType: "residential", ownership: "owned", currency: CURRENCY[country] ?? "GBP" }, token);
                })}
              >
                Save & continue
              </button>
              <button type="button" {...stylex.props(styles.skip)} onClick={() => next("first_property")} data-testid="step-skip">Skip for now</button>
            </div>
          </>
        )}

        {(step === "initial_people" || step === "mailboxes" || step === "optional_integrations") && (
          <>
            <div {...stylex.props(styles.h)}>{STEP_LABEL[step]}</div>
            <div {...stylex.props(styles.p)}>
              {step === "initial_people" && "Invite your manager and household staff — each gets their own scoped access. You can do this anytime from People."}
              {step === "mailboxes" && "Kanzen sets up operational mailboxes (deliveries, accounts, house, vendors) once Workspace is connected. We'll create the Kanzen-side rows now."}
              {step === "optional_integrations" && "Connect your bank (read-only) and market-data feeds whenever you're ready — these are optional."}
            </div>
            <div {...stylex.props(styles.actions)}>
              <button type="button" disabled={busy} {...stylex.props(styles.primary)} onClick={() => next(step)} data-testid="step-primary">Continue</button>
              <button type="button" {...stylex.props(styles.skip)} onClick={() => next(step)} data-testid="step-skip">Skip</button>
            </div>
          </>
        )}

        {step === "tour" && (
          <>
            <div {...stylex.props(styles.h)}>You're ready 🎉</div>
            <div {...stylex.props(styles.p)}>Your household is set up. Finish to head to your dashboard — the collaborative inbox is where the flow of life begins.</div>
            <div {...stylex.props(styles.actions)}>
              <button type="button" disabled={busy} {...stylex.props(styles.primary)} onClick={() => next("tour")} data-testid="step-primary">Finish setup</button>
            </div>
          </>
        )}

        {error && <div {...stylex.props(styles.err)} role="alert">{error}</div>}
      </div>
    </div>
  );
}

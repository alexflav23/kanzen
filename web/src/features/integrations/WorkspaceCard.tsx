import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../../styles/tokens.stylex";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { Loading } from "../../components/states";
import { useAuth } from "../../state/AuthContext";
import { connectWorkspace, getWorkspaceStatus, setWorkspaceCalendar } from "../../services/workspace";
import { ApiError } from "../../services/http";

const styles = stylex.create({
  pad: { padding: "22px 24px" },
  label: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600, marginBottom: "4px" },
  blurb: { fontSize: "13px", color: colors.ink3, marginBottom: "16px", lineHeight: 1.5 },
  statusRow: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", backgroundColor: colors.bgSunken, borderRadius: radius.md, marginBottom: "16px" },
  statusName: { flex: 1, minWidth: 0 },
  statusTitle: { fontSize: "13px", fontWeight: 500, color: colors.ink },
  statusSub: { fontSize: "11.5px", color: colors.ink3, marginTop: "1px" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  fieldLabel: { fontSize: "11px", color: colors.ink3 },
  input: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12px", width: "100%", boxSizing: "border-box", minHeight: "80px", fontFamily: "monospace", resize: "vertical" },
  hint: { fontSize: "11.5px", color: colors.ink3 },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", alignSelf: "flex-start" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  err: { fontSize: "12.5px", color: colors.danger, marginTop: "4px" },
  calBlock: { marginTop: "20px", paddingTop: "18px", borderTop: `1px solid ${colors.line}` },
  calRow: { display: "flex", gap: "8px", alignItems: "stretch" },
});

/** F44 — Settings → Integrations → Google Workspace. The principal pastes a service-account key; only its Secrets-Manager
  * reference is stored (the key bytes never reach Postgres). A validation probe runs through the WorkspaceAuth seam.
  */
export function WorkspaceCard() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const statusQ = useQuery({ queryKey: ["workspace", token], queryFn: () => getWorkspaceStatus(token) });

  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [json, setJson] = useState("");
  const [calendarId, setCalendarId] = useState("");

  const connectMut = useMutation({
    mutationFn: () => connectWorkspace({ domain: domain.trim(), serviceAccountEmail: email.trim(), serviceAccountJson: json }, token),
    onSuccess: () => {
      setJson(""); // never keep the pasted key in component state once it's been handed off
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const calendarMut = useMutation({
    mutationFn: () => setWorkspaceCalendar(calendarId.trim(), token),
    onSuccess: () => { setCalendarId(""); qc.invalidateQueries({ queryKey: ["workspace"] }); },
  });

  const s = statusQ.data;
  const canSubmit = domain.trim() !== "" && email.includes("@") && json.includes("private_key") && !connectMut.isPending;

  return (
    <Card style={styles.pad}>
      <div {...stylex.props(styles.label)}>Google Workspace</div>
      <p {...stylex.props(styles.blurb)}>
        Connect a domain-wide service account so Kanzen can send mail, sync calendars and file documents as your team. We
        store only a <strong>Secrets&nbsp;Manager reference</strong> — the private key never touches the database.
      </p>

      {statusQ.isPending ? (
        <Loading />
      ) : (
        <div {...stylex.props(styles.statusRow)} data-testid="workspace-status">
          <div {...stylex.props(styles.statusName)}>
            <div {...stylex.props(styles.statusTitle)}>
              {s?.connected ? `Connected · ${s.domain}` : "Not connected"}
            </div>
            <div {...stylex.props(styles.statusSub)}>
              {s?.connected
                ? s.validated
                  ? "Service account validated"
                  : s.validationError ?? "Awaiting validation"
                : "Paste a service-account key below to connect"}
            </div>
          </div>
          {s?.connected ? (
            <Pill tone={s.validated ? "accent" : "warn"}>{s.validated ? "OK" : "Pending"}</Pill>
          ) : (
            <Pill tone="default">Off</Pill>
          )}
        </div>
      )}

      <div {...stylex.props(styles.form)}>
        <div {...stylex.props(styles.fieldGroup)}>
          <label {...stylex.props(styles.fieldLabel)} htmlFor="ws-domain">Workspace domain</label>
          <input id="ws-domain" {...stylex.props(styles.input)} placeholder="e.g. carter-household.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div {...stylex.props(styles.fieldGroup)}>
          <label {...stylex.props(styles.fieldLabel)} htmlFor="ws-email">Service-account email</label>
          <input id="ws-email" {...stylex.props(styles.input)} placeholder="kanzen@project.iam.gserviceaccount.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div {...stylex.props(styles.fieldGroup)}>
          <label {...stylex.props(styles.fieldLabel)} htmlFor="ws-json">Service-account JSON key</label>
          <textarea id="ws-json" {...stylex.props(styles.textarea)} placeholder='{"type":"service_account", …}' value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
          <span {...stylex.props(styles.hint)}>Pasted once, written to Secrets Manager, then discarded — it is never stored in Kanzen.</span>
        </div>
        <button
          type="button"
          {...stylex.props(styles.btn, !canSubmit && styles.btnDisabled)}
          disabled={!canSubmit}
          onClick={() => connectMut.mutate()}
        >
          {connectMut.isPending ? "Connecting…" : s?.connected ? "Reconnect" : "Connect Workspace"}
        </button>
        {connectMut.isError && (
          <div {...stylex.props(styles.err)} role="alert">
            {connectMut.error instanceof ApiError ? connectMut.error.detail : "Couldn't connect the Workspace."}
          </div>
        )}
      </div>

      {/* F07 Path B — once Workspace is connected, map a Google calendar to push household events to. */}
      {s?.connected && (
        <div {...stylex.props(styles.calBlock)} data-testid="calendar-map">
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.fieldLabel)} htmlFor="ws-cal">Google Calendar sync</label>
            <div {...stylex.props(styles.calRow)}>
              <input
                id="ws-cal"
                {...stylex.props(styles.input)}
                placeholder={s.calendarId ?? "household@group.calendar.google.com"}
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
              />
              <button
                type="button"
                {...stylex.props(styles.btn, (calendarId.trim() === "" || calendarMut.isPending) && styles.btnDisabled)}
                disabled={calendarId.trim() === "" || calendarMut.isPending}
                onClick={() => calendarMut.mutate()}
              >
                {calendarMut.isPending ? "Saving…" : s.calendarId ? "Update" : "Connect calendar"}
              </button>
            </div>
            <span {...stylex.props(styles.hint)}>
              {s.calendarId
                ? `Pushing household events to ${s.calendarId}.`
                : "Household calendar events will push to this Google calendar."}
            </span>
            {calendarMut.isError && (
              <div {...stylex.props(styles.err)} role="alert">
                {calendarMut.error instanceof ApiError ? calendarMut.error.detail : "Couldn't map the calendar."}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

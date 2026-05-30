import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill, type PillTone } from "../components/Pill";
import { Alert, Check } from "../components/icons";
import { MediaGallery } from "../components/MediaGallery";
import { daysUntil, getPerson } from "../services/people";
import { listProperties } from "../services/properties";
import { useAuth } from "../state/AuthContext";
import { ColourPicker } from "../components/ColourPicker";
import { Loading, ErrorState } from "../components/states";

const styles = stylex.create({
  page: { maxWidth: "880px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  head: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" },
  avatar: { width: "56px", height: "56px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, display: "grid", placeItems: "center", fontWeight: 600, fontSize: "20px", flexShrink: 0 },
  name: { fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  sub: { color: colors.ink3, fontSize: "13.5px", marginTop: "3px" },
  pills: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "24px", marginTop: "12px" },
  section: { marginBottom: "20px" },
  kv: { display: "grid", gridTemplateColumns: "180px 1fr", rowGap: "12px", columnGap: "16px", padding: "18px 20px" },
  k: { fontSize: "12.5px", color: colors.ink3 },
  v: { fontSize: "13.5px", color: colors.ink, fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1, minWidth: 0 },
  cname: { fontWeight: 500, color: colors.ink },
  cmeta: { fontSize: "12.5px", color: colors.ink3, marginTop: "2px" },
  notes: { padding: "18px 20px", fontSize: "13.5px", color: colors.ink2, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  pad: { padding: "18px 20px" },
  empty: { padding: "18px 20px", fontSize: "13px", color: colors.ink3 },
});

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const dayTone = (d: number): PillTone => (d < 0 ? "danger" : d < 30 ? "warn" : "default");
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (<><div {...stylex.props(styles.k)}>{k}</div><div {...stylex.props(styles.v)}>{children}</div></>);
}

/** F10 (W7.1) — a person's HR record: particulars, contract + key dates, emergency contacts,
 * payroll reference (external bureau, reference only), notes, and HR documents. */
export function PersonDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token, can, userId } = useAuth();
  const personQ = useQuery({ queryKey: ["person", id, token], queryFn: () => getPerson(id, token) });
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const canWrite = can("person", "write");

  const back = <button type="button" onClick={() => navigate("/people")} {...stylex.props(styles.back)}>← People</button>;
  if (personQ.isPending) return <div {...stylex.props(styles.page)}>{back}<Loading label="Loading the record…" /></div>;
  if (personQ.isError) return <div {...stylex.props(styles.page)}>{back}<ErrorState error={personQ.error} /></div>;

  const p = personQ.data;
  const propName = propsQ.data?.find((x) => x.id === p.propertyId)?.name ?? null;
  const pe = daysUntil(p.permitExpiry);
  const rd = daysUntil(p.reviewDue);

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      <div {...stylex.props(styles.head)}>
        <span {...stylex.props(styles.avatar)}>{initials(p.name)}</span>
        <div>
          <h1 {...stylex.props(styles.name)} data-testid="person-name">{p.name}</h1>
          <div {...stylex.props(styles.sub)}>{[p.role, p.jurisdiction?.toUpperCase(), propName].filter(Boolean).join(" · ") || "—"}</div>
        </div>
      </div>
      <div {...stylex.props(styles.pills)}>
        {p.userId ? <Pill tone="accent">App access</Pill> : <Pill>No login</Pill>}
        {p.permitExpiry && pe != null && <Pill tone={dayTone(pe)}><Alert size={11} /> Permit · {pe < 0 ? "expired" : `${pe}d`}</Pill>}
        {p.reviewDue && rd != null && <Pill tone={dayTone(rd)}>Review · {rd < 0 ? "overdue" : `${rd}d`}</Pill>}
        {!p.permitExpiry && !p.reviewDue && <Pill><Check size={11} /> compliant</Pill>}
      </div>

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Particulars &amp; contract</CardTitle></CardHeader>
          <div {...stylex.props(styles.kv)}>
            <Row k="Role">{p.role ?? "—"}</Row>
            <Row k="Jurisdiction">{p.jurisdiction?.toUpperCase() ?? "—"}</Row>
            <Row k="Based at">{propName ?? "—"}</Row>
            <Row k="Contract">{p.contractType ?? "—"}</Row>
            <Row k="Start date">{fmtDate(p.startDate)}</Row>
            <Row k="End date">{fmtDate(p.endDate)}</Row>
            <Row k="Work permit no.">{p.workPermitNo ?? "—"}</Row>
            <Row k="Permit expiry">{fmtDate(p.permitExpiry)}</Row>
            <Row k="Next review">{fmtDate(p.reviewDue)}</Row>
            <Row k="Payroll ref.">{p.payrollRef ?? "—"}</Row>
          </div>
        </Card>
      </div>

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Emergency contacts · {p.emergencyContacts.length}</CardTitle></CardHeader>
          {p.emergencyContacts.length === 0
            ? <div {...stylex.props(styles.empty)}>No emergency contacts on file.</div>
            : p.emergencyContacts.map((c, i) => (
                <CardRow key={`${c.name}-${i}`}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.cname)} data-testid="emergency-contact">{c.name}</div>
                    <div {...stylex.props(styles.cmeta)}>{[c.relation, c.phone].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                </CardRow>
              ))}
        </Card>
      </div>

      {p.notes && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <div {...stylex.props(styles.notes)}>{p.notes}</div>
          </Card>
        </div>
      )}

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>HR documents</CardTitle></CardHeader>
          <div {...stylex.props(styles.pad)}>
            <MediaGallery targetType="person" targetId={id} propertyId={p.propertyId} label="documents" readOnly={!canWrite} />
          </div>
        </Card>
      </div>

      {/* F47 — identity colour picker, shown only when viewing your own record */}
      {p.userId && userId && p.userId === userId && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader><CardTitle>Your colour</CardTitle></CardHeader>
            <div {...stylex.props(styles.pad)}>
              <ColourPicker name={p.name} current={p.colour} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

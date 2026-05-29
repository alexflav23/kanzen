import * as stylex from "@stylexjs/stylex";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill, type PillTone } from "../components/Pill";
import { Alert, Plus, Check, ChevronRight } from "../components/icons";
import { createPerson, daysUntil, listPeople, type Person } from "../services/people";
import { listProperties } from "../services/properties";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink, marginTop: "8px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  card: { marginBottom: "24px" },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", backgroundColor: colors.accentSoft, color: colors.accent, display: "grid", placeItems: "center", fontWeight: 600, fontSize: "14px", flexShrink: 0 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontWeight: 500, color: colors.ink },
  meta: { color: colors.ink3, fontSize: "12.5px", marginTop: "2px" },
  pills: { display: "flex", gap: "6px", alignItems: "center" },
  attnBar: { width: "5px", backgroundColor: colors.warn, flexShrink: 0 },
  attnCard: { padding: 0, overflow: "hidden", display: "flex", marginBottom: "24px" },
  attnBody: { flex: 1 },
  rowHead: { display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  rowLink: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px", borderBottom: `1px solid ${colors.line}`, textDecoration: "none", color: "inherit", cursor: "pointer", ":hover": { backgroundColor: colors.bgSunken } },
  chev: { color: colors.ink4, display: "inline-flex", flexShrink: 0 },
  small: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12.5px", color: colors.ink3 },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "440px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
});

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const dayTone = (d: number): PillTone => (d < 0 ? "danger" : d < 30 ? "warn" : "default");

/** Compliance chips: work-permit + review countdowns (within 90 days, or always when `always`). */
function complianceChips(p: Person, always = false): ReactNode[] {
  const out: ReactNode[] = [];
  const pe = daysUntil(p.permitExpiry);
  if (p.permitExpiry && pe != null && (always || pe < 90))
    out.push(<Pill key="permit" tone={dayTone(pe)}><Alert size={11} /> Permit · {pe < 0 ? "expired" : `${pe}d`}</Pill>);
  const rd = daysUntil(p.reviewDue);
  if (p.reviewDue && rd != null && (always || rd < 90))
    out.push(<Pill key="review" tone={dayTone(rd)}>Review · {rd < 0 ? "overdue" : `${rd}d`}</Pill>);
  return out;
}

function AddPersonModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");
  const [reviewDue, setReviewDue] = useState("");
  const create = useMutation({
    mutationFn: () => createPerson({ name: name.trim(), role: role.trim() || null, jurisdiction: jurisdiction.trim() || null, propertyId: propertyId || null, permitExpiry: permitExpiry || null, reviewDue: reviewDue || null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="add-person" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Add a team member</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomas Reyes" autoFocus /></label>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Role</span>
            <input {...stylex.props(styles.control)} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Chauffeur" /></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Jurisdiction</span>
            <input {...stylex.props(styles.control)} aria-label="Jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. UK" /></label>
        </div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Based at (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">—</option>
            {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.two)}>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Work permit expiry</span>
            <input {...stylex.props(styles.control)} type="date" aria-label="Permit expiry" value={permitExpiry} onChange={(e) => setPermitExpiry(e.target.value)} /></label>
          <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Next review</span>
            <input {...stylex.props(styles.control)} type="date" aria-label="Review due" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} /></label>
        </div>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.btn)} disabled={!name.trim() || create.isPending}>{create.isPending ? "Adding…" : "Add person"}</button>
        </div>
      </form>
    </div>
  );
}

export function People() {
  const { token, role } = useAuth();
  const peopleQ = useQuery({ queryKey: ["people", token], queryFn: () => listPeople(token) });
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [showAdd, setShowAdd] = useState(false);
  const canManage = role != null && role !== "staff";
  const propName = (id: string | null) => propsQ.data?.find((p) => p.id === id)?.name;

  const people = peopleQ.data ?? [];
  // "Attention" = anyone with a permit or review due within 90 days (soonest first).
  const attention = people
    .map((p) => ({ p, soonest: Math.min(daysUntil(p.permitExpiry) ?? 9e9, daysUntil(p.reviewDue) ?? 9e9) }))
    .filter((x) => x.soonest < 90)
    .sort((a, b) => a.soonest - b.soonest);

  return (
    <div>
      <div {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Household · team &amp; HR</div>
          <h1 {...stylex.props(styles.title)}>People</h1>
        </div>
        {canManage && <button type="button" {...stylex.props(styles.btn)} onClick={() => setShowAdd(true)}><Plus size={14} /> Add person</button>}
      </div>

      {peopleQ.isPending ? <Loading label="Loading the team…" />
        : peopleQ.isError ? <ErrorState error={peopleQ.error} />
        : people.length === 0 ? <EmptyState title="No people yet">Add household team members to track HR and permits.</EmptyState>
        : (
          <>
            {attention.length > 0 && (
              <Card style={styles.attnCard}>
                <div {...stylex.props(styles.attnBar)} />
                <div {...stylex.props(styles.attnBody)}>
                  <div {...stylex.props(styles.rowHead)}>
                    <Pill tone="warn"><Alert size={11} /> Needs attention</Pill>
                    <span {...stylex.props(styles.small)}>Work permits &amp; reviews due within 90 days</span>
                  </div>
                  {attention.map(({ p }) => (
                    <CardRow key={p.id} testId="attention-row">
                      <span {...stylex.props(styles.avatar)}>{initials(p.name)}</span>
                      <div {...stylex.props(styles.grow)}>
                        <div {...stylex.props(styles.name)}>{p.name}</div>
                        <div {...stylex.props(styles.meta)}>{[p.role, propName(p.propertyId)].filter(Boolean).join(" · ")}</div>
                      </div>
                      <span {...stylex.props(styles.pills)}>{complianceChips(p)}</span>
                    </CardRow>
                  ))}
                </div>
              </Card>
            )}

            <Card style={styles.card}>
              <CardHeader><CardTitle>Household team · {people.length}</CardTitle></CardHeader>
              {people.map((p) => {
                const chips = complianceChips(p, true);
                return (
                  <Link key={p.id} to={`/people/${p.id}`} {...stylex.props(styles.rowLink)} aria-label={`Open ${p.name}'s record`}>
                    <span {...stylex.props(styles.avatar)} data-testid="person-row">{initials(p.name)}</span>
                    <div {...stylex.props(styles.grow)}>
                      <div {...stylex.props(styles.name)}>{p.name}</div>
                      <div {...stylex.props(styles.meta)}>
                        {[p.role ?? "—", p.jurisdiction?.toUpperCase(), propName(p.propertyId)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span {...stylex.props(styles.pills)}>
                      {chips.length > 0 ? chips : <span {...stylex.props(styles.small)}><Check size={12} /> compliant</span>}
                    </span>
                    <span {...stylex.props(styles.chev)}><ChevronRight size={14} /></span>
                  </Link>
                );
              })}
            </Card>
          </>
        )}

      {showAdd && <AddPersonModal token={token} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

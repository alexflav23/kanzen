import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { AgentRibbon } from "./AgentRibbon";
import { Check, X } from "./icons";
import { Loading, ErrorState } from "./states";
import { useAuth } from "../state/AuthContext";
import { proposalDetail } from "../services/collabInbox";

function money(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "GBP" }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

/** W9.4 — the proposal review popup: the itemised receipt or dated event behind an agent suggestion, so confirming is
 *  a considered "OK". Financial actions are still logged for approval only — Kanzen never moves money (F27). */
export function ProposalReviewModal(props: {
  proposalId: string;
  onConfirm: () => void;
  onDismiss: () => void;
  onClose: () => void;
  confirming: boolean;
}) {
  const { proposalId, onConfirm, onDismiss, onClose, confirming } = props;
  const { token } = useAuth();
  const q = useQuery({ queryKey: ["proposal-detail", proposalId, token], queryFn: () => proposalDetail(proposalId, token) });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = q.data;
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" aria-label="Review suggestion" onClick={onClose}>
      <div {...stylex.props(styles.modal)} onClick={(e) => e.stopPropagation()} data-testid="proposal-modal">
        {q.isPending ? <Loading /> : q.isError || !d ? <ErrorState error={q.error} /> : (
          <>
            <div {...stylex.props(styles.head)}>
              <AgentRibbon>Kanzen</AgentRibbon>
              {d.confidence != null && <span {...stylex.props(styles.conf)}>{Math.round(d.confidence * 100)}% sure</span>}
            </div>
            <h2 {...stylex.props(styles.title)}>{d.title ?? "Suggested action"}</h2>
            <p {...stylex.props(styles.willCreate)}>Confirming creates {d.willCreate}</p>

            {d.kind === "receipt" && (
              <div {...stylex.props(styles.section)} data-testid="proposal-receipt">
                <div {...stylex.props(styles.metaRow)}>
                  <span>{d.payee ?? d.description ?? "Receipt"}</span>
                  <span {...stylex.props(styles.metaMuted)}>{[d.date, d.category].filter(Boolean).join(" · ")}</span>
                </div>
                <ul {...stylex.props(styles.items)}>
                  {d.lineItems.map((it, i) => (
                    <li key={i} {...stylex.props(styles.item)}>
                      <span {...stylex.props(styles.itemDesc)}>{it.description}</span>
                      <span {...stylex.props(styles.itemAmt)}>{money(it.amountMinor, d.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div {...stylex.props(styles.total)}>
                  <span>Total</span>
                  <span {...stylex.props(styles.totalAmt)} data-testid="proposal-total">{money(d.totalMinor, d.currency)}</span>
                </div>
              </div>
            )}

            {d.kind === "event" && (
              <dl {...stylex.props(styles.eventGrid)} data-testid="proposal-event">
                {d.date && (<><dt {...stylex.props(styles.dt)}>Date</dt><dd {...stylex.props(styles.dd)}>{d.date}</dd></>)}
                {d.time && (<><dt {...stylex.props(styles.dt)}>Time</dt><dd {...stylex.props(styles.dd)}>{d.time}</dd></>)}
                {d.location && (<><dt {...stylex.props(styles.dt)}>Where</dt><dd {...stylex.props(styles.dd)}>{d.location}</dd></>)}
                {d.links.map((l) => (<div key={l.targetType} {...stylex.props(styles.linkRow)}><dt {...stylex.props(styles.dt)}>Links to</dt><dd {...stylex.props(styles.dd)}>{l.label}</dd></div>))}
              </dl>
            )}

            {d.kind === "task" && (
              <dl {...stylex.props(styles.eventGrid)} data-testid="proposal-task">
                {d.date && (<><dt {...stylex.props(styles.dt)}>Due</dt><dd {...stylex.props(styles.dd)}>{d.date}</dd></>)}
                {d.assignee && (<><dt {...stylex.props(styles.dt)}>Assignee</dt><dd {...stylex.props(styles.dd)}>{d.assignee}</dd></>)}
                {d.priority && (<><dt {...stylex.props(styles.dt)}>Priority</dt><dd {...stylex.props(styles.dd)}>{d.priority}</dd></>)}
                {d.links.map((l) => (<div key={l.targetType} {...stylex.props(styles.linkRow)}><dt {...stylex.props(styles.dt)}>About</dt><dd {...stylex.props(styles.dd)}>{l.label}</dd></div>))}
              </dl>
            )}

            {d.kind === "list" && (
              <div {...stylex.props(styles.section)} data-testid="proposal-list">
                <div {...stylex.props(styles.metaRow)}>
                  <span>{d.listName ?? "List"}</span>
                  <span {...stylex.props(styles.metaMuted)}>{d.lineItems.length} item{d.lineItems.length === 1 ? "" : "s"}</span>
                </div>
                <ul {...stylex.props(styles.items)}>
                  {d.lineItems.map((it, i) => (
                    <li key={i} {...stylex.props(styles.item)}>
                      <span {...stylex.props(styles.itemDesc)}>{it.description}</span>
                      {it.qty != null && it.qty > 1 && <span {...stylex.props(styles.itemAmt)}>×{it.qty}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.kind === "other" && d.summary && <p {...stylex.props(styles.summary)}>{d.summary}</p>}

            <div {...stylex.props(styles.actions)}>
              <button type="button" {...stylex.props(styles.ghost)} onClick={() => { onDismiss(); onClose(); }}><X size={13} /> Dismiss</button>
              <button type="button" {...stylex.props(styles.primary)} disabled={confirming} data-testid="proposal-confirm" onClick={onConfirm}><Check size={14} /> Confirm</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = stylex.create({
  overlay: { position: "fixed", inset: 0, backgroundColor: colors.scrim, display: "grid", placeItems: "center", zIndex: 80, padding: "24px" },
  modal: { width: "480px", maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, boxShadow: colors.shadowPop, padding: "22px 24px" },
  head: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  conf: { marginLeft: "auto", fontSize: "11px", fontWeight: 600, color: colors.accent },
  title: { fontSize: "18px", fontWeight: 600, color: colors.ink, margin: 0 },
  willCreate: { fontSize: "13px", color: colors.ink3, margin: "6px 0 16px", lineHeight: 1.45 },
  section: { border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: "12px 14px", backgroundColor: colors.bg },
  metaRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: colors.ink, paddingBottom: "10px", borderBottom: `1px solid ${colors.line}` },
  metaMuted: { fontSize: "12px", fontWeight: 400, color: colors.ink3 },
  items: { listStyle: "none", margin: 0, padding: "8px 0", display: "flex", flexDirection: "column", gap: "5px" },
  item: { display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "13px", color: colors.ink2 },
  itemDesc: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemAmt: { fontVariantNumeric: "tabular-nums", color: colors.ink2, flexShrink: 0 },
  total: { display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: `1px solid ${colors.line}`, fontSize: "14px", fontWeight: 600, color: colors.ink },
  totalAmt: { fontVariantNumeric: "tabular-nums" },
  eventGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px", border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: "14px 16px", backgroundColor: colors.bg, margin: 0 },
  linkRow: { gridColumn: "1 / -1" },
  dt: { fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: colors.ink3, marginBottom: "3px" },
  dd: { fontSize: "14px", color: colors.ink, margin: 0 },
  summary: { fontSize: "13.5px", color: colors.ink2, lineHeight: 1.5 },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px", fontFamily: "inherit" },
  primary: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "inherit" },
});

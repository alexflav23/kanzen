import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus } from "../components/icons";
import {
  getAsset, getAssetTimeline, getInsurance, getValuations, listWarranties, logAssetEvent, recordValuation,
} from "../services/assets";
import { listCategories } from "../services/categories";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  page: { maxWidth: "1100px" },
  back: { display: "inline-flex", alignItems: "center", gap: "6px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "13px", marginBottom: "16px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "6px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  pills: { display: "flex", gap: "6px", marginTop: "10px", marginBottom: "24px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" },
  kv: { display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${colors.line}`, fontSize: "13.5px" },
  kvK: { color: colors.ink3, textTransform: "capitalize" },
  kvV: { fontWeight: 500, textTransform: "capitalize" },
  note: { padding: "14px 20px", fontSize: "12.5px", color: colors.ink3 },
  section: { marginTop: "24px" },
  grow: { flex: 1 },
  evTitle: { fontSize: "13.5px", fontWeight: 500, textTransform: "capitalize" },
  evSub: { fontSize: "12px", color: colors.ink3 },
  evCost: { fontVariantNumeric: "tabular-nums", fontWeight: 500 },
  lifetime: { display: "flex", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${colors.line}`, fontSize: "13.5px", fontWeight: 600 },
  action: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "12.5px" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "12px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "5px" },
  control: { width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
  ghost: { padding: "8px 16px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px" },
  primary: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
});

function money(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "GBP" }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

// Mirrors the backend's allowed lifecycle event types (api.AssetEvents.TYPES).
const EVENT_TYPES = ["serviced", "repaired", "cleaned", "moved", "appraised", "inspected", "restored", "lent", "returned", "note"];

function LogEventModal({ id, token, onClose }: { id: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState("serviced");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      logAssetEvent(id, token, {
        eventType,
        costMinor: cost.trim() ? Math.round(parseFloat(cost) * 100) : null,
        currency: cost.trim() ? "GBP" : null,
        note: note.trim() || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["asset-timeline", id] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="log-event" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Log event</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Type</span>
          <select {...stylex.props(styles.control)} aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Cost (£, optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 450" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Note</span>
          <input {...stylex.props(styles.control)} aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual service at AP" autoFocus /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending}>{mutation.isPending ? "Logging…" : "Log event"}</button>
        </div>
      </form>
    </div>
  );
}

function RecordValuationModal({ id, token, onClose }: { id: string; token: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState("market");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const mutation = useMutation({
    mutationFn: () => recordValuation(id, token, { kind, amountMinor: Math.round(parseFloat(amount || "0") * 100), currency: "GBP", source: source.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-valuations", id] });
      qc.invalidateQueries({ queryKey: ["asset", id] }); // Key facts shows the latest valuation
      onClose();
    },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="record-valuation" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (amount.trim()) mutation.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Record valuation</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Kind</span>
          <select {...stylex.props(styles.control)} aria-label="Valuation kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["market", "insured", "appraisal"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Amount (£)</span>
          <input {...stylex.props(styles.control)} aria-label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 38000" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Source (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. AP boutique appraisal" /></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.ghost)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.primary)} disabled={mutation.isPending || !amount.trim()}>{mutation.isPending ? "Saving…" : "Record"}</button>
        </div>
      </form>
    </div>
  );
}

export function AssetDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token, can } = useAuth();
  const [logging, setLogging] = useState(false);
  const [valuing, setValuing] = useState(false);
  const assetQ = useQuery({ queryKey: ["asset", id, token], queryFn: () => getAsset(id, token) });
  const catsQ = useQuery({ queryKey: ["categories", token], queryFn: () => listCategories(token), enabled: assetQ.isSuccess });
  const timelineQ = useQuery({ queryKey: ["asset-timeline", id, token], queryFn: () => getAssetTimeline(id, token), enabled: assetQ.isSuccess });
  const warrantiesQ = useQuery({ queryKey: ["asset-warranties", id, token], queryFn: () => listWarranties(id, token), enabled: assetQ.isSuccess });
  // Valuation history + insurance are Principal-only; a Manager session 403s — render only on success.
  const valuationsQ = useQuery({ queryKey: ["asset-valuations", id, token], queryFn: () => getValuations(id, token), enabled: assetQ.isSuccess, retry: false });
  const insuranceQ = useQuery({ queryKey: ["asset-insurance", id, token], queryFn: () => getInsurance(id, token), enabled: assetQ.isSuccess, retry: false });
  const isPrincipal = can("*", "admin");

  const back = <button type="button" onClick={() => navigate("/inventory")} {...stylex.props(styles.back)}>← Inventory</button>;
  if (assetQ.isPending) return <div {...stylex.props(styles.page)}>{back}<Loading label="Loading the asset…" /></div>;
  if (assetQ.isError) return <div {...stylex.props(styles.page)}>{back}<ErrorState error={assetQ.error} /></div>;

  const a = assetQ.data;
  const categoryName = (catsQ.data ?? []).find((c) => c.id === a.categoryId)?.name ?? "—";
  const attrs = Object.entries(a.attributes ?? {});
  const modeLabel = a.trackingMode === "grouped_quantity" ? `grouped ×${a.quantity}` : a.trackingMode.replace("_", " ");

  return (
    <div {...stylex.props(styles.page)}>
      {back}
      {logging && <LogEventModal id={id} token={token} onClose={() => setLogging(false)} />}
      {valuing && <RecordValuationModal id={id} token={token} onClose={() => setValuing(false)} />}
      <div>
        {a.maker && <div {...stylex.props(styles.eyebrow)}>{a.maker}</div>}
        <h1 {...stylex.props(styles.title)}>{a.title}</h1>
        <div {...stylex.props(styles.pills)}>
          <Pill tone="accent">{categoryName}</Pill>
          <Pill>{modeLabel}</Pill>
          <Pill>{a.ownershipStatus}</Pill>
        </div>
      </div>

      <div {...stylex.props(styles.layout)}>
        <Card>
          <CardHeader><CardTitle>Key facts</CardTitle></CardHeader>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Category</span><span {...stylex.props(styles.kvV)}>{categoryName}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Tracking</span><span {...stylex.props(styles.kvV)}>{modeLabel}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Quantity</span><span {...stylex.props(styles.kvV)}>{a.quantity}</span></div>
          <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Acquisition</span><span {...stylex.props(styles.kvV)}>{money(a.acquisitionCostMinor, a.acquisitionCurrency)}</span></div>
          {(a.marketValueMinor != null || a.insuredValueMinor != null) && (
            <>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Market value</span><span {...stylex.props(styles.kvV)}>{money(a.marketValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
              <div {...stylex.props(styles.kv)}><span {...stylex.props(styles.kvK)}>Insured value</span><span {...stylex.props(styles.kvV)}>{money(a.insuredValueMinor ?? null, a.valuationCurrency ?? null)}</span></div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
          {attrs.length === 0 ? (
            <EmptyState title="No specifications">Add typed attributes for this vertical.</EmptyState>
          ) : (
            attrs.map(([k, v]) => (
              <div key={k} {...stylex.props(styles.kv)} data-testid="spec-row">
                <span {...stylex.props(styles.kvK)}>{k.replace(/_/g, " ")}</span>
                <span {...stylex.props(styles.kvV)}>{String(v)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <button type="button" onClick={() => setLogging(true)} {...stylex.props(styles.action)}><Plus size={13} /> Log event</button>
          </CardHeader>
          {timelineQ.isPending ? <Loading label="Loading the timeline…" />
            : timelineQ.isError ? <ErrorState error={timelineQ.error} />
            : timelineQ.data.events.length === 0 ? <EmptyState title="No events yet">Log acquisition, service, and movement events to build the timeline.</EmptyState>
            : (
              <>
                {timelineQ.data.events.map((e) => (
                  <CardRow key={e.id}>
                    <div {...stylex.props(styles.grow)}>
                      <div {...stylex.props(styles.evTitle)}>{e.eventType}</div>
                      <div {...stylex.props(styles.evSub)}>{e.occurredAt.slice(0, 10)}{e.note ? ` · ${e.note}` : ""}</div>
                    </div>
                    {e.costMinor != null && <span {...stylex.props(styles.evCost)}>{money(e.costMinor, e.currency)}</span>}
                  </CardRow>
                ))}
                <div {...stylex.props(styles.lifetime)}><span>Lifetime cost</span><span>{money(timelineQ.data.lifetimeCostMinor, "GBP")}</span></div>
              </>
            )}
        </Card>
      </div>

      {isPrincipal && (
        <div {...stylex.props(styles.section)}>
          <Card>
            <CardHeader>
              <CardTitle>Valuations</CardTitle>
              <button type="button" onClick={() => setValuing(true)} {...stylex.props(styles.action)}><Plus size={13} /> Record valuation</button>
            </CardHeader>
            {valuationsQ.isPending ? <Loading label="Loading valuations…" />
              : valuationsQ.isError ? <div {...stylex.props(styles.note)}>Valuations are Principal-only.</div>
              : valuationsQ.data.length === 0 ? <EmptyState title="No valuations recorded">Record a market or insured valuation to track this asset's worth over time.</EmptyState>
              : valuationsQ.data.map((v) => (
                  <CardRow key={v.id} testId="valuation-row">
                    <div {...stylex.props(styles.grow)}><div {...stylex.props(styles.evTitle)}>{v.kind}</div></div>
                    <span {...stylex.props(styles.evCost)}>{money(v.amountMinor, v.currency)}</span>
                  </CardRow>
                ))}
          </Card>
        </div>
      )}

      <div {...stylex.props(styles.section)}>
        <Card>
          <CardHeader><CardTitle>Insurance &amp; warranty</CardTitle></CardHeader>
          {insuranceQ.isSuccess && (
            <div {...stylex.props(styles.kv)}>
              <span {...stylex.props(styles.kvK)}>Insurance</span>
              <span {...stylex.props(styles.kvV)}>
                {insuranceQ.data.insured
                  ? `${insuranceQ.data.policyRef ?? "Policy"}${insuranceQ.data.insuredValueMinor != null ? ` · ${money(insuranceQ.data.insuredValueMinor, "GBP")}` : ""}`
                  : "Not insured"}
              </span>
            </div>
          )}
          {warrantiesQ.isPending ? <Loading label="Loading warranties…" />
            : warrantiesQ.isError ? <ErrorState error={warrantiesQ.error} />
            : warrantiesQ.data.length === 0 ? <div {...stylex.props(styles.note)}>No warranties recorded. {insuranceQ.isError ? "Insurance is Principal-only." : ""}</div>
            : warrantiesQ.data.map((w) => (
                <CardRow key={w.id}>
                  <div {...stylex.props(styles.grow)}>
                    <div {...stylex.props(styles.evTitle)}>{w.provider ?? "Warranty"}</div>
                    <div {...stylex.props(styles.evSub)}>{w.endsOn ? `ends ${w.endsOn.slice(0, 10)}` : "—"}</div>
                  </div>
                </CardRow>
              ))}
        </Card>
      </div>
    </div>
  );
}

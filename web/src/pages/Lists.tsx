import * as stylex from "@stylexjs/stylex";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Check, X, Alert, ArrowRight, Box, Settings } from "../components/icons";
import {
  addItem,
  approveItem,
  createList,
  editList,
  declineItem,
  listItems,
  listLists,
  placeOrder,
  type ListItem,
  type ShoppingList,
} from "../services/lists";
import { listProperties } from "../services/properties";
import { useAuth } from "../state/AuthContext";
import { fmtMoney } from "../data/money";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, fontWeight: 600 },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px" },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink, marginTop: "8px" },
  sub: { fontSize: "13.5px", color: colors.ink2, marginTop: "6px", maxWidth: "520px" },
  grid: { display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px", alignItems: "start", "@media (max-width: 880px)": { gridTemplateColumns: "1fr" } },
  rail: { display: "flex", flexDirection: "column", gap: "8px", position: "sticky", top: "16px" },
  railCard: { textAlign: "left", padding: "14px 16px", cursor: "pointer", borderRadius: radius.md, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, display: "block", width: "100%" },
  railCardActive: { borderColor: colors.accent, boxShadow: `0 0 0 2px ${colors.accentSoft}` },
  railTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  railName: { fontSize: "13px", fontWeight: 500, color: colors.ink },
  railCycle: { fontSize: "11px", color: colors.ink3, textTransform: "capitalize" },
  spacer: { flex: 1 },
  detail: { display: "flex", flexDirection: "column", gap: "20px" },
  hCard: { padding: "22px 26px" },
  hRow: { display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "16px" },
  h2: { fontSize: "20px", fontWeight: 600, letterSpacing: "-0.014em", color: colors.ink, margin: "6px 0 4px" },
  metaSub: { fontSize: "12.5px", color: colors.ink2 },
  nextWrap: { textAlign: "right", flexShrink: 0 },
  nextDate: { fontSize: "20px", fontWeight: 600, letterSpacing: "-0.014em", color: colors.ink, marginTop: "6px" },
  nextDays: { fontSize: "12.5px", color: colors.ink3 },
  chipsRow: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  chip: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "999px", backgroundColor: colors.bgSunken, fontSize: "12.5px", color: colors.ink2 },
  chipWarn: { backgroundColor: colors.warnSoft, color: colors.warn },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  btnAccent: { border: 0, backgroundColor: colors.accent, color: colors.accentInk },
  btnSm: { padding: "5px 10px", fontSize: "12.5px" },
  approvalCard: { padding: 0, overflow: "hidden", display: "flex" },
  approvalBar: { width: "5px", backgroundColor: colors.warn, flexShrink: 0 },
  approvalBody: { flex: 1 },
  rowHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: `1px solid ${colors.line}` },
  row: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: `1px solid ${colors.line}` },
  rowGrow: { flex: 1, minWidth: 0 },
  rowName: { fontSize: "14px", fontWeight: 500, color: colors.ink },
  rowMeta: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  note: { fontSize: "12.5px", color: colors.ink2, fontStyle: "italic", marginTop: "4px" },
  subRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 18px 4px 52px", fontSize: "12.5px", color: colors.ink2 },
  subOr: { fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: colors.ink4, fontWeight: 600, flexShrink: 0 },
  subName: { flex: 1, minWidth: 0 },
  addSub: { display: "inline-flex", alignItems: "center", gap: "5px", border: 0, background: "transparent", color: colors.ink3, cursor: "pointer", fontSize: "12px", padding: "2px 18px 8px 52px" },
  subInputRow: { display: "flex", alignItems: "center", gap: "8px", padding: "2px 18px 8px 52px" },
  subInput: { flex: 1, padding: "5px 9px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "12.5px" },
  addCard: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px" },
  addInput: { flex: 1, border: 0, backgroundColor: "transparent", color: colors.ink, fontSize: "14px", outline: { default: "none", ":focus": "none" } },
  catHeader: { padding: "12px 18px 8px", backgroundColor: colors.bg, borderBottom: `1px solid ${colors.line}` },
  checkbox: { width: "22px", height: "22px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", border: `1.5px solid ${colors.line}`, backgroundColor: "transparent", cursor: "pointer", flexShrink: 0, color: colors.accentInk },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  struck: { textDecoration: "line-through", color: colors.ink3 },
  iconBtn: { display: "inline-flex", alignItems: "center", padding: "5px", borderRadius: radius.sm, border: 0, backgroundColor: "transparent", cursor: "pointer", color: colors.ink3 },
  // modal
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "420px", backgroundColor: colors.bgElev, borderRadius: radius.lg, border: `1px solid ${colors.line}`, padding: "26px" },
  modalTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "18px", color: colors.ink },
  field: { display: "block", marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", color: colors.ink3, marginBottom: "6px" },
  control: { width: "100%", padding: "9px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", boxSizing: "border-box" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" },
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDayLong = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const daysUntil = (iso: string) => {
  const d = new Date(iso + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(d / 86_400_000);
};

/** A confirmed item plus its substitutes ("sub items" — alternatives if the primary is out of stock). */
function ItemRow({ item, subs, on, onToggle, onRemove, onAddSub }: {
  item: ListItem;
  subs: ListItem[];
  on: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
  onAddSub: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [sub, setSub] = useState("");
  const submit = () => {
    const v = sub.trim();
    if (v) { onAddSub(v); setSub(""); setAdding(false); }
  };
  return (
    <div data-testid="list-item-row">
      <div {...stylex.props(styles.row)}>
        <button type="button" {...stylex.props(styles.checkbox, on && styles.checkboxOn)} aria-label={`Tick ${item.name}`} aria-pressed={on} onClick={onToggle}>
          {on && <Check size={12} />}
        </button>
        <div {...stylex.props(styles.rowGrow, on && styles.struck)}>
          <div {...stylex.props(styles.rowName, on && styles.struck)}>{item.name}{item.qty > 1 ? ` · ×${item.qty}` : ""}</div>
          <div {...stylex.props(styles.rowMeta)}>{[item.addedBy && `added by ${item.addedBy}`, item.recurring && "recurring"].filter(Boolean).join(" · ") || " "}</div>
        </div>
        {item.recurring && <Pill tone="accent">staple</Pill>}
        <button type="button" {...stylex.props(styles.iconBtn)} aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}><X size={14} /></button>
      </div>
      {subs.map((s) => (
        <div {...stylex.props(styles.subRow)} key={s.id} data-testid="sub-item">
          <span {...stylex.props(styles.subOr)}>or</span>
          <span {...stylex.props(styles.subName)}>{s.name}{s.qty > 1 ? ` · ×${s.qty}` : ""}</span>
          <button type="button" {...stylex.props(styles.iconBtn)} aria-label={`Remove substitute ${s.name}`} onClick={() => onRemove(s.id)}><X size={12} /></button>
        </div>
      ))}
      {adding ? (
        <div {...stylex.props(styles.subInputRow)}>
          <input
            {...stylex.props(styles.subInput)}
            aria-label={`Substitute for ${item.name}`}
            placeholder="e.g. another brand if out of stock…"
            autoFocus
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setSub(""); } }}
          />
          <button type="button" {...stylex.props(styles.btn, styles.btnSm)} disabled={!sub.trim()} onClick={submit}>Add</button>
        </div>
      ) : (
        <button type="button" {...stylex.props(styles.addSub)} onClick={() => setAdding(true)}><Plus size={11} /> Add substitute</button>
      )}
    </div>
  );
}

function ListDetail({ list, propName, canDecide }: { list: ShoppingList; propName?: string; canDecide: boolean }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const itemsQ = useQuery({ queryKey: ["list-items", list.id, token], queryFn: () => listItems(list.id, token) });

  useEffect(() => setChecked({}), [list.id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["list-items", list.id] });
  const add = useMutation({ mutationFn: () => addItem(list.id, { name: name.trim() }, token), onSuccess: () => { setName(""); invalidate(); } });
  const addSub = useMutation({ mutationFn: (v: { parent: string; name: string }) => addItem(list.id, { name: v.name.trim(), substituteFor: v.parent }, token), onSuccess: invalidate });
  const approve = useMutation({ mutationFn: (id: string) => approveItem(id, token), onSuccess: invalidate });
  const decline = useMutation({ mutationFn: (id: string) => declineItem(id, token), onSuccess: invalidate });
  const order = useMutation({ mutationFn: () => placeOrder(list.id, token), onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }) });

  const items = itemsQ.data ?? [];
  const live = items.filter((i) => i.status !== "declined");
  const topLevel = live.filter((i) => !i.substituteFor);
  const subsOf = (id: string) => live.filter((i) => i.substituteFor === id);
  const needsApproval = topLevel.filter((i) => i.status === "needs_approval");
  const confirmed = topLevel.filter((i) => i.status === "added");
  const recurringCount = confirmed.filter((i) => i.recurring).length;

  const grouped = useMemo(() => {
    const g = new Map<string, ListItem[]>();
    for (const i of confirmed) {
      const cat = i.category ?? "Other";
      const arr = g.get(cat) ?? [];
      arr.push(i);
      g.set(cat, arr);
    }
    return [...g.entries()];
  }, [confirmed]);

  return (
    <div {...stylex.props(styles.detail)}>
      <Card style={styles.hCard}>
        <div {...stylex.props(styles.hRow)}>
          <div {...stylex.props(styles.rowGrow)}>
            <div {...stylex.props(styles.eyebrow)}>{[propName, list.cycle && cap(list.cycle)].filter(Boolean).join(" · ")}</div>
            <div {...stylex.props(styles.h2)}>{list.name}</div>
            <div {...stylex.props(styles.metaSub)}>
              {list.vendor ? `Delivers via ${list.vendor}` : "No vendor set"}
              {" · "}
              {confirmed.length} item{confirmed.length === 1 ? "" : "s"} confirmed
            </div>
          </div>
          {list.nextOrder && (
            <div {...stylex.props(styles.nextWrap)}>
              <div {...stylex.props(styles.eyebrow)}>Next order</div>
              <div {...stylex.props(styles.nextDate)}>{fmtDayLong(list.nextOrder)}</div>
              <div {...stylex.props(styles.nextDays)}>{daysUntil(list.nextOrder)} days</div>
            </div>
          )}
        </div>
        <div {...stylex.props(styles.chipsRow)}>
          <span {...stylex.props(styles.chip)}><Check size={12} /> {confirmed.length} confirmed</span>
          {needsApproval.length > 0 && (
            <span {...stylex.props(styles.chip, styles.chipWarn)}><Alert size={12} /> {needsApproval.length} need approval</span>
          )}
          <span {...stylex.props(styles.chip)}>{recurringCount} recurring</span>
          <span {...stylex.props(styles.spacer)} />
          {canDecide && (
            <button type="button" {...stylex.props(styles.btn, styles.btnSm)} data-testid="configure-list" onClick={() => setEditing(true)}>
              <Settings size={12} /> Configure
            </button>
          )}
          {list.vendor && (
            <button type="button" {...stylex.props(styles.btn, styles.btnSm)} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(list.vendor!)}`, "_blank", "noopener")}>
              <ArrowRight size={12} /> Open with {list.vendor}
            </button>
          )}
          {canDecide && (
            <button type="button" {...stylex.props(styles.btn, styles.btnAccent, styles.btnSm)} data-testid="place-order" disabled={order.isPending} onClick={() => order.mutate()}>
              {order.isPending ? "Ordering…" : "Place order"}
            </button>
          )}
        </div>
      </Card>

      {itemsQ.isPending ? <Loading label="Loading items…" /> : itemsQ.isError ? <ErrorState error={itemsQ.error} /> : (
        <>
          {needsApproval.length > 0 && (
            <Card style={styles.approvalCard}>
              <div {...stylex.props(styles.approvalBar)} />
              <div {...stylex.props(styles.approvalBody)}>
                <div {...stylex.props(styles.rowHeader)}>
                  <Pill tone="warn">Items awaiting you</Pill>
                  <span {...stylex.props(styles.rowMeta)}>Above-staple items or budget triggers</span>
                </div>
                {needsApproval.map((i) => (
                  <div {...stylex.props(styles.row)} key={i.id} data-testid="approval-row">
                    <div {...stylex.props(styles.rowGrow)}>
                      <div {...stylex.props(styles.rowName)}>{i.name}</div>
                      <div {...stylex.props(styles.rowMeta)}>
                        {[i.category, `qty ${i.qty}`, i.addedBy && `requested by ${i.addedBy}`, i.estPriceMinor != null && `est. ${fmtMoney(i.estPriceMinor, i.currency ?? "GBP")}`].filter(Boolean).join(" · ")}
                      </div>
                      {i.note && <div {...stylex.props(styles.note)}>“{i.note}”</div>}
                    </div>
                    {canDecide ? (
                      <>
                        <button type="button" {...stylex.props(styles.btn, styles.btnSm)} aria-label={`Decline ${i.name}`} onClick={() => decline.mutate(i.id)}><X size={13} /> Decline</button>
                        <button type="button" {...stylex.props(styles.btn, styles.btnAccent, styles.btnSm)} aria-label={`Approve ${i.name}`} onClick={() => approve.mutate(i.id)}><Check size={13} /> Approve</button>
                      </>
                    ) : (
                      <Pill tone="warn">Awaiting approval</Pill>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card style={styles.addCard}>
            <Plus size={16} />
            <input
              {...stylex.props(styles.addInput)}
              aria-label={`Add to ${list.name}`}
              placeholder="Add an item to this list…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) add.mutate(); }}
            />
            <button type="button" {...stylex.props(styles.btn, styles.btnSm)} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>Add</button>
          </Card>

          {confirmed.length === 0 && needsApproval.length === 0 ? (
            <EmptyState title="Empty list">Add an item, or a staple to auto-add each cycle.</EmptyState>
          ) : (
            <Card>
              {grouped.map(([cat, catItems]) => (
                <div key={cat}>
                  <div {...stylex.props(styles.catHeader)}><span {...stylex.props(styles.eyebrow)}>{cat} · {catItems.length}</span></div>
                  {catItems.map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      subs={subsOf(i.id)}
                      on={!!checked[i.id]}
                      onToggle={() => setChecked((c) => ({ ...c, [i.id]: !c[i.id] }))}
                      onRemove={(id) => decline.mutate(id)}
                      onAddSub={(nm) => addSub.mutate({ parent: i.id, name: nm })}
                    />
                  ))}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {editing && <EditListModal list={list} onClose={() => setEditing(false)} />}
    </div>
  );
}

const CYCLES = ["weekly", "fortnightly", "monthly"];
const LIST_TYPES = ["grocery", "supplies", "other"];

function EditListModal({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [name, setName] = useState(list.name);
  const [vendor, setVendor] = useState(list.vendor ?? "");
  const [propertyId, setPropertyId] = useState(list.propertyId ?? "");
  const [cycle, setCycle] = useState(list.cycle ?? "weekly");
  const [nextOrder, setNextOrder] = useState(list.nextOrder ?? "");
  const [type, setType] = useState(list.type);
  const save = useMutation({
    mutationFn: () => editList(list.id, { name: name.trim(), vendor: vendor.trim() || null, propertyId: propertyId || null, cycle: cycle || null, nextOrder: nextOrder || null, type }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lists"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="edit-list" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>Configure list</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="List name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Property</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">—</option>
            {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Vendor</span>
          <input {...stylex.props(styles.control)} aria-label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Waitrose" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Order frequency</span>
          <select {...stylex.props(styles.control)} aria-label="Frequency" value={cycle} onChange={(e) => setCycle(e.target.value)}>
            {CYCLES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Next order</span>
          <input {...stylex.props(styles.control)} type="date" aria-label="Next order" value={nextOrder} onChange={(e) => setNextOrder(e.target.value)} /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Type</span>
          <select {...stylex.props(styles.control)} aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {LIST_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.btn)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.btn, styles.btnAccent)} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function NewListModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const create = useMutation({
    mutationFn: () => createList({ name: name.trim(), vendor: vendor.trim() || null, propertyId: propertyId || null }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lists"] }); onClose(); },
  });
  return (
    <div {...stylex.props(styles.overlay)} role="dialog" aria-modal="true" onClick={onClose}>
      <form {...stylex.props(styles.modal)} data-testid="new-list" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
        <div {...stylex.props(styles.modalTitle)}>New list</div>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Name</span>
          <input {...stylex.props(styles.control)} aria-label="List name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grocery — Wardian" autoFocus /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Vendor (optional)</span>
          <input {...stylex.props(styles.control)} aria-label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Waitrose" /></label>
        <label {...stylex.props(styles.field)}><span {...stylex.props(styles.label)}>Property (optional)</span>
          <select {...stylex.props(styles.control)} aria-label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">—</option>
            {(propsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <div {...stylex.props(styles.actions)}>
          <button type="button" {...stylex.props(styles.btn)} onClick={onClose}>Cancel</button>
          <button type="submit" {...stylex.props(styles.btn, styles.btnAccent)} disabled={!name.trim() || create.isPending}>{create.isPending ? "Creating…" : "Create list"}</button>
        </div>
      </form>
    </div>
  );
}

function ListRailCard({ list, active, onClick, token }: { list: ShoppingList; active: boolean; onClick: () => void; token: string | null }) {
  const itemsQ = useQuery({ queryKey: ["list-items", list.id, token], queryFn: () => listItems(list.id, token) });
  const needs = (itemsQ.data ?? []).filter((i) => i.status === "needs_approval").length;
  return (
    <button type="button" {...stylex.props(styles.railCard, active && styles.railCardActive)} onClick={onClick} data-testid="list-rail">
      <div {...stylex.props(styles.railTop)}>
        <Box size={14} />
        <span {...stylex.props(styles.railName)}>{list.name}</span>
        <span {...stylex.props(styles.spacer)} />
        {needs > 0 && <Pill tone="warn">{needs}</Pill>}
      </div>
      <div {...stylex.props(styles.railCycle)}>{[list.cycle && cap(list.cycle), list.vendor].filter(Boolean).join(" · ") || list.type}</div>
    </button>
  );
}

export function Lists() {
  const { token, role } = useAuth();
  const listsQ = useQuery({ queryKey: ["lists", token], queryFn: () => listLists(token) });
  const propsQ = useQuery({ queryKey: ["properties", token], queryFn: () => listProperties(token) });
  const canDecide = role != null && role !== "staff"; // effective (token-derived) role — correct under impersonation
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const lists = listsQ.data ?? [];
  const active = lists.find((l) => l.id === activeId) ?? lists[0];
  const propName = (id: string | null) => propsQ.data?.find((p) => p.id === id)?.name;

  return (
    <div>
      <div {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Household lists</div>
          <h1 {...stylex.props(styles.title)}>Lists</h1>
          <div {...stylex.props(styles.sub)}>Recurring shopping. Staff propose, you approve, the list closes on order day and rolls forward.</div>
        </div>
        <button type="button" {...stylex.props(styles.btn, styles.btnAccent)} onClick={() => setShowNew(true)}><Plus size={14} /> New list</button>
      </div>

      {listsQ.isPending ? <Loading label="Loading lists…" /> : listsQ.isError ? <ErrorState error={listsQ.error} />
        : lists.length === 0 ? <EmptyState title="No lists yet">Create a shopping list to start.</EmptyState>
        : (
          <div {...stylex.props(styles.grid)}>
            <div {...stylex.props(styles.rail)}>
              {lists.map((l) => (
                <ListRailCard key={l.id} list={l} active={l.id === active?.id} onClick={() => setActiveId(l.id)} token={token} />
              ))}
            </div>
            {active && <ListDetail list={active} propName={propName(active.propertyId)} canDecide={canDecide} />}
          </div>
        )}

      {showNew && <NewListModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

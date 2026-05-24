import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Check, X } from "../components/icons";
import { addItem, approveItem, declineItem, listItems, listLists, type ShoppingList } from "../services/lists";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

const styles = stylex.create({
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink, marginBottom: "20px" },
  card: { marginBottom: "24px" },
  grow: { flex: 1 },
  name: { fontWeight: 500 },
  add: { display: "flex", gap: "8px", padding: "12px 18px" },
  input: { flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  actions: { display: "flex", gap: "6px" },
  iconBtn: { display: "inline-flex", alignItems: "center", padding: "5px 8px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, cursor: "pointer", color: colors.ink2 },
});

const tone = (s: string): "default" | "warn" | "danger" => (s === "needs_approval" ? "warn" : s === "declined" ? "danger" : "default");

function ListSection({ list, token, canDecide }: { list: ShoppingList; token: string | null; canDecide: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const itemsQ = useQuery({ queryKey: ["list-items", list.id, token], queryFn: () => listItems(list.id, token) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["list-items", list.id] });
  const add = useMutation({ mutationFn: () => addItem(list.id, name, token), onSuccess: () => { setName(""); invalidate(); } });
  const approve = useMutation({ mutationFn: (id: string) => approveItem(id, token), onSuccess: invalidate });
  const decline = useMutation({ mutationFn: (id: string) => declineItem(id, token), onSuccess: invalidate });

  return (
    <Card style={styles.card}>
      <CardHeader><CardTitle>{list.name}{list.vendor ? ` · ${list.vendor}` : ""}</CardTitle></CardHeader>
      {itemsQ.isPending ? <Loading /> : itemsQ.isError ? <ErrorState error={itemsQ.error} />
        : itemsQ.data.length === 0 ? <EmptyState title="Empty list" />
        : itemsQ.data.map((it) => (
            <CardRow key={it.id}>
              <span {...stylex.props(styles.grow, styles.name)} data-testid="list-item-row">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ""}</span>
              {it.recurring && <Pill tone="accent">staple</Pill>}
              <Pill tone={tone(it.status)}>{it.status.replace("_", " ")}</Pill>
              {canDecide && it.status === "needs_approval" && (
                <span {...stylex.props(styles.actions)}>
                  <button type="button" {...stylex.props(styles.iconBtn)} aria-label="Approve" onClick={() => approve.mutate(it.id)}><Check size={13} /></button>
                  <button type="button" {...stylex.props(styles.iconBtn)} aria-label="Decline" onClick={() => decline.mutate(it.id)}><X size={13} /></button>
                </span>
              )}
            </CardRow>
          ))}
      <div {...stylex.props(styles.add)}>
        <input {...stylex.props(styles.input)} aria-label={`Add to ${list.name}`} placeholder="Add an item…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" {...stylex.props(styles.btn)} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> Add</button>
      </div>
    </Card>
  );
}

export function Lists() {
  const { token, persona } = useAuth();
  const listsQ = useQuery({ queryKey: ["lists", token], queryFn: () => listLists(token) });
  const canDecide = persona?.role !== "staff";

  return (
    <div>
      <div {...stylex.props(styles.eyebrow)}>Operations · shopping & checklists</div>
      <h1 {...stylex.props(styles.title)}>Lists</h1>
      {listsQ.isPending ? <Loading label="Loading lists…" /> : listsQ.isError ? <ErrorState error={listsQ.error} />
        : listsQ.data.length === 0 ? <EmptyState title="No lists yet">Create a shopping list to start.</EmptyState>
        : listsQ.data.map((l) => <ListSection key={l.id} list={l} token={token} canDecide={canDecide} />)}
    </div>
  );
}

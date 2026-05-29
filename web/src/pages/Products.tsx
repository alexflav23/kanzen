import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { Card, CardHeader, CardTitle, CardRow } from "../components/Card";
import { Pill } from "../components/Pill";
import { Plus, Alert, External, Refresh } from "../components/icons";
import { createProduct, listProducts, setStock, type Product } from "../services/products";
import { useAuth } from "../state/AuthContext";
import { Loading, EmptyState, ErrorState } from "../components/states";

// F35/F36 — Supplies: the consumables the household keeps in stock (right spec + where to buy),
// stock chips, and a one-tap reorder lens (low/out). Deep cadence forecasting is F36 (W8).
const STOCK: { value: Product["stockStatus"]; label: string }[] = [
  { value: "in_stock", label: "In stock" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
];
const tone = (s: Product["stockStatus"]): "danger" | "warn" | "default" => (s === "out" ? "danger" : s === "low" ? "warn" : "default");
const chipLabel = (s: Product["stockStatus"]) => (s === "out" ? "out" : s === "low" ? "low" : "in stock");

const styles = stylex.create({
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.ink3, marginBottom: "8px", fontWeight: 600 },
  title: { fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", color: colors.ink },
  desc: { color: colors.ink3, marginTop: "6px", fontSize: "14px" },
  add: { display: "flex", gap: "8px" },
  input: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13.5px", width: "200px" },
  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px" },
  reorder: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: radius.sm, backgroundColor: colors.warnSoft, color: colors.warn, fontSize: "13px", marginBottom: "16px", fontWeight: 500 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontWeight: 500 },
  sub: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  actions: { display: "flex", alignItems: "center", gap: "10px" },
  buy: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12.5px", color: colors.accent, textDecoration: "none" },
  seg: { display: "inline-flex", borderRadius: radius.sm, border: `1px solid ${colors.line}`, overflow: "hidden" },
  segBtn: { padding: "5px 10px", border: 0, borderLeft: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink3, cursor: "pointer", fontSize: "12px" },
  segFirst: { borderLeft: 0 },
  segActive: { backgroundColor: colors.accent, color: colors.accentInk },
});

export function Products() {
  const { token, role } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const canManage = role != null && role !== "staff";
  const products = useQuery({ queryKey: ["products", token], queryFn: () => listProducts(token) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });
  const add = useMutation({ mutationFn: () => createProduct(name.trim(), null, null, token), onSuccess: () => { setName(""); invalidate(); } });
  const stock = useMutation({ mutationFn: (v: { id: string; status: Product["stockStatus"] }) => setStock(v.id, v.status, token), onSuccess: invalidate });

  const items = products.data ?? [];
  const reorderCount = items.filter((p) => p.needsReorder).length;

  return (
    <div>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>Operations · supplies</div>
          <h1 {...stylex.props(styles.title)}>Supplies</h1>
          <div {...stylex.props(styles.desc)}>The consumables the household keeps in stock — the right spec, and where to buy.</div>
        </div>
        {canManage && (
          <div {...stylex.props(styles.add)}>
            <input {...stylex.props(styles.input)} aria-label="New supply" placeholder="New supply…" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" {...stylex.props(styles.btn)} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> Add</button>
          </div>
        )}
      </header>

      {reorderCount > 0 && (
        <div {...stylex.props(styles.reorder)} role="status" data-testid="reorder-banner">
          <Refresh size={14} /> {reorderCount} {reorderCount === 1 ? "item needs" : "items need"} reordering
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Shelf · {items.length}</CardTitle></CardHeader>
        {products.isPending ? <Loading /> : products.isError ? <ErrorState error={products.error} />
          : items.length === 0 ? <EmptyState title="No supplies">Add a consumable to keep stocked.</EmptyState>
          : items.map((p) => (
              <CardRow key={p.id}>
                <div {...stylex.props(styles.grow)}>
                  <div {...stylex.props(styles.name)} data-testid="product-row">{p.name}</div>
                  <div {...stylex.props(styles.sub)}>
                    {[p.preferredSpec, p.unit, p.vendor].filter(Boolean).join(" · ") || "No preferred spec"}
                  </div>
                </div>
                <div {...stylex.props(styles.actions)}>
                  {p.needsReorder && p.buyUrl && (
                    <a {...stylex.props(styles.buy)} href={p.buyUrl} target="_blank" rel="noreferrer" aria-label={`Buy ${p.name}`}>Buy <External size={11} /></a>
                  )}
                  {canManage ? (
                    <div {...stylex.props(styles.seg)} role="group" aria-label={`Set stock for ${p.name}`}>
                      {STOCK.map((s, i) => (
                        <button key={s.value} type="button" aria-pressed={p.stockStatus === s.value} disabled={stock.isPending}
                          {...stylex.props(styles.segBtn, i === 0 && styles.segFirst, p.stockStatus === s.value && styles.segActive)}
                          onClick={() => p.stockStatus !== s.value && stock.mutate({ id: p.id, status: s.value })}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Pill tone={tone(p.stockStatus)}>{p.stockStatus === "out" && <Alert size={11} />}{chipLabel(p.stockStatus)}</Pill>
                  )}
                </div>
              </CardRow>
            ))}
      </Card>
    </div>
  );
}

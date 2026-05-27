import * as stylex from "@stylexjs/stylex";
import type { ComponentType } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { fmtMoney } from "../data/money";
import { Plus, Wrench, Pin, Move, Alert, Documents, Trending, Box, ArrowRight, Receipt, Check } from "./icons";

/** F19 — the reusable, typed, colour-coded timeline (design `asset-detail.jsx → TimelineTab` / `EventDot`).
 *  Used by the asset Lifecycle card; built generic so the platform audit/activity log reuses it (a caller can
 *  pass an explicit `tone` when the item's `type` isn't an asset-event type). Token-driven via ThemeContext. */

export type TimelineTone = "accent" | "positive" | "info" | "violet" | "danger" | "muted";

export type TimelineItem = {
  id: string;
  type: string; // domain type — drives tone+icon via the category map unless `tone` is given
  at: string; // ISO timestamp
  title: string;
  subtitle?: string | null;
  party?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  tone?: TimelineTone; // explicit override (e.g. audit entries that aren't asset-event types)
};

type Cat = { tone: TimelineTone; icon: ComponentType<{ size?: number }> };

// Asset lifecycle event types → dot tone + icon (mirrors the design EventDot map).
const CATEGORY: Record<string, Cat> = {
  acquired: { tone: "accent", icon: Plus },
  appraised: { tone: "positive", icon: Trending },
  serviced: { tone: "info", icon: Wrench },
  repaired: { tone: "info", icon: Wrench },
  restored: { tone: "info", icon: Wrench },
  cleaned: { tone: "info", icon: Wrench },
  inspected: { tone: "info", icon: Check },
  moved: { tone: "violet", icon: Pin },
  lent: { tone: "violet", icon: Move },
  returned: { tone: "violet", icon: ArrowRight },
  lost: { tone: "danger", icon: Alert },
  stolen: { tone: "danger", icon: Alert },
  sold: { tone: "muted", icon: Receipt },
  gifted: { tone: "muted", icon: Receipt },
  note: { tone: "muted", icon: Documents },
};
const TONE_ICON: Record<TimelineTone, ComponentType<{ size?: number }>> = {
  accent: Plus, positive: Trending, info: Wrench, violet: Move, danger: Alert, muted: Box,
};
const catFor = (it: TimelineItem): Cat =>
  it.tone ? { tone: it.tone, icon: TONE_ICON[it.tone] } : (CATEGORY[it.type] ?? { tone: "muted", icon: Box });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

const styles = stylex.create({
  list: { listStyle: "none", margin: 0, padding: 0 },
  row: { display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 20px", borderTop: `1px solid ${colors.line}` },
  date: { width: "62px", flexShrink: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11.5px", color: colors.ink3, paddingTop: "4px", fontVariantNumeric: "tabular-nums" },
  dot: { width: "24px", height: "24px", flexShrink: 0, borderRadius: radius.pill, display: "grid", placeItems: "center", marginTop: "1px" },
  dotAccent: { backgroundColor: colors.accentSoft, color: colors.accent },
  dotPositive: { backgroundColor: colors.positiveSoft, color: colors.positive },
  dotInfo: { backgroundColor: colors.infoSoft, color: colors.info },
  dotViolet: { backgroundColor: colors.violetSoft, color: colors.violet },
  dotDanger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  dotMuted: { backgroundColor: colors.bgSunken, color: colors.ink4 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: "13.5px", fontWeight: 500, color: colors.ink, textTransform: "capitalize" },
  sub: { fontSize: "12px", color: colors.ink3, marginTop: "2px" },
  cost: { fontSize: "13px", fontWeight: 500, color: colors.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", paddingTop: "2px" },
});

const dotStyle = (tone: TimelineTone) => {
  switch (tone) {
    case "accent": return styles.dotAccent;
    case "positive": return styles.dotPositive;
    case "info": return styles.dotInfo;
    case "violet": return styles.dotViolet;
    case "danger": return styles.dotDanger;
    default: return styles.dotMuted;
  }
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol {...stylex.props(styles.list)}>
      {items.map((it) => {
        const { tone, icon: Ico } = catFor(it);
        const sub = [it.subtitle, it.party].filter(Boolean).join(" · ");
        return (
          <li key={it.id} {...stylex.props(styles.row)} data-testid="timeline-row" data-tone={tone}>
            <time {...stylex.props(styles.date)} dateTime={it.at}>{fmtDate(it.at)}</time>
            <span {...stylex.props(styles.dot, dotStyle(tone))} aria-hidden="true"><Ico size={12} /></span>
            <div {...stylex.props(styles.body)}>
              <div {...stylex.props(styles.title)}>{it.title}</div>
              {sub && <div {...stylex.props(styles.sub)}>{sub}</div>}
            </div>
            {it.amountMinor != null && (
              <span {...stylex.props(styles.cost)}>{fmtMoney(it.amountMinor, it.currency ?? "GBP")}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

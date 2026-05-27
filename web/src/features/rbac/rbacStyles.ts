import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../../styles/tokens.stylex";

/** Shared token-driven styles for the RBAC builder (F02 v2). Everything resolves through the global theme
 *  (ThemeContext) — no inline values, no per-component theme branching. */
export const rbac = stylex.create({
  tabBar: { display: "flex", gap: "4px", padding: "4px", borderRadius: radius.md, backgroundColor: colors.bgSunken, marginBottom: "20px", width: "fit-content" },
  tab: { appearance: "none", border: 0, background: "transparent", color: colors.ink3, padding: "7px 14px", borderRadius: radius.sm, fontSize: "13px", fontWeight: 500, cursor: "pointer" },
  tabActive: { backgroundColor: colors.bgElev, color: colors.ink, boxShadow: colors.shadow1 },

  twoCol: { display: "grid", gridTemplateColumns: "260px 1fr", gap: "18px", alignItems: "start" },
  side: { display: "flex", flexDirection: "column", gap: "2px" },
  sideItem: { appearance: "none", textAlign: "left", border: `1px solid transparent`, background: "transparent", borderRadius: radius.sm, padding: "10px 12px", cursor: "pointer", color: colors.ink2, display: "flex", flexDirection: "column", gap: "2px" },
  sideItemActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  sideName: { fontSize: "13px", fontWeight: 600, color: colors.ink },
  sideMeta: { fontSize: "11.5px", color: colors.ink3 },
  sideIndent: { marginLeft: "14px" },

  main: { minWidth: 0 },
  sectionTitle: { fontSize: "15px", fontWeight: 600, color: colors.ink, marginBottom: "2px" },
  blockTop: { marginTop: "20px" },
  sectionDesc: { fontSize: "12.5px", color: colors.ink3, marginBottom: "14px", maxWidth: "560px" },
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },

  // resource/action grant grid
  group: { border: `1px solid ${colors.line}`, borderRadius: radius.md, marginBottom: "10px", overflow: "hidden" },
  groupHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: colors.bgSunken, cursor: "pointer", border: 0, width: "100%", textAlign: "left" },
  groupName: { fontSize: "13px", fontWeight: 600, color: colors.ink, textTransform: "capitalize" },
  groupCount: { fontSize: "11px", color: colors.ink3 },
  actionRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "9px 14px", borderTop: `1px solid ${colors.line}` },
  actionName: { fontSize: "13px", color: colors.ink2, display: "flex", alignItems: "center", gap: "8px" },
  actionVerb: { fontWeight: 500, color: colors.ink, textTransform: "capitalize" },
  actionControls: { display: "flex", alignItems: "center", gap: "8px" },

  seg: { display: "inline-flex", border: `1px solid ${colors.line}`, borderRadius: radius.sm, overflow: "hidden" },
  segBtn: { appearance: "none", border: 0, background: colors.bgElev, color: colors.ink3, padding: "5px 11px", fontSize: "12px", cursor: "pointer", borderRight: `1px solid ${colors.line}` },
  segBtnLast: { borderRight: 0 },
  segActive: { backgroundColor: colors.bgSunken, color: colors.ink, fontWeight: 600 },
  segAllow: { backgroundColor: colors.positiveSoft, color: colors.positive, fontWeight: 600 },
  segDeny: { backgroundColor: colors.dangerSoft, color: colors.danger, fontWeight: 600 },

  select: { padding: "5px 8px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12px", cursor: "pointer" },
  input: { padding: "7px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", minWidth: "180px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "11px", color: colors.ink3 },
  addRow: { display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "14px" },

  btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 11px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, cursor: "pointer", fontSize: "12.5px" },
  btnDanger: { color: colors.danger },
  disabled: { opacity: 0.5, cursor: "not-allowed" },

  chips: { display: "flex", flexWrap: "wrap", gap: "6px" },
  chip: { appearance: "none", display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: radius.pill, border: `1px solid ${colors.line}`, backgroundColor: colors.bgElev, color: colors.ink2, fontSize: "12px", cursor: "pointer" },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, color: colors.accent, fontWeight: 600 },

  list: { display: "flex", flexDirection: "column" },
  listRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "9px 0", borderTop: `1px solid ${colors.line}` },
  muted: { fontSize: "12.5px", color: colors.ink3 },
  sensitive: { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: colors.warn, backgroundColor: colors.warnSoft, borderRadius: radius.sm, padding: "1px 6px" },

  // effective preview
  previewHead: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "12px" },
  scopePill: { fontSize: "10.5px", color: colors.ink3, border: `1px solid ${colors.line}`, borderRadius: radius.sm, padding: "1px 6px" },
  scopeNarrow: { color: colors.accent, borderColor: colors.accentSoft, backgroundColor: colors.accentSoft },

  err: { fontSize: "12.5px", color: colors.danger, marginTop: "8px" },
  empty: { fontSize: "13px", color: colors.ink3, padding: "24px 0" },
});

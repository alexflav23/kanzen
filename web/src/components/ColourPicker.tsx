import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { colors, radius } from "../styles/tokens.stylex";
import { contrastRatio, glowShadow, hexFor, isValidColourInput, PALETTE_KEYS, type PaletteKey } from "./personPalette";
import { Avatar } from "./Avatar";
import { useAuth } from "../state/AuthContext";
import { setMyColour } from "../services/people";

/** F47 — the picker. A 12-swatch palette + a custom hex input + a live avatar preview. Saves to PATCH /api/me/colour.
 *  Only available for the user editing themselves (the caller gates that). */
export function ColourPicker({ name, current }: { name: string; current: string | null | undefined }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [value, setValue] = useState(current ?? "indigo");
  const [custom, setCustom] = useState(current && current.startsWith("#") ? current : "");
  const [saved, setSaved] = useState(false);

  const m = useMutation({
    mutationFn: () => setMyColour(token, value),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });

  const ink = "#0A0B0F"; // for the contrast probe — Kanzen's ink token in light theme
  const previewHex = hexFor(value);
  const customRatio = previewHex ? contrastRatio(previewHex, ink) : 0;
  const customOk = !custom || (isValidColourInput(custom) && customRatio >= 1.5);

  return (
    <div {...stylex.props(styles.wrap)} data-testid="colour-picker">
      <div {...stylex.props(styles.row)}>
        <Avatar name={name} size={48} colour={value} />
        <div {...stylex.props(styles.col)}>
          <div {...stylex.props(styles.label)}>Identity colour</div>
          <div {...stylex.props(styles.help)}>A rounded glow ring on your avatar, used everywhere you appear — comments, assignments, the inbox. So we know it's you at a glance.</div>
        </div>
      </div>

      <div {...stylex.props(styles.swatches)} role="radiogroup" aria-label="Pick a palette colour">
        {PALETTE_KEYS.map((k: PaletteKey) => {
          const hex = hexFor(k)!;
          const selected = value === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={selected}
              {...stylex.props(styles.swatch, selected && styles.swatchOn)}
              style={{ background: hex, boxShadow: selected ? glowShadow(hex) : undefined }}
              data-testid={`colour-${k}`}
              onClick={() => { setValue(k); setCustom(""); }}
              aria-label={k} title={k}
            />
          );
        })}
      </div>

      <div {...stylex.props(styles.customRow)}>
        <label {...stylex.props(styles.label)} htmlFor="cust-hex">Or a custom hex</label>
        <input id="cust-hex" {...stylex.props(styles.input)} type="text" placeholder="#A45B6E"
          aria-invalid={!customOk}
          value={custom} onChange={(e) => {
            const v = e.target.value;
            setCustom(v);
            if (isValidColourInput(v)) setValue(v);
          }} />
        {custom && !customOk && (
          <div {...stylex.props(styles.warn)} role="alert">Pick a value that's readable against ink — try a bolder hue.</div>
        )}
      </div>

      <div {...stylex.props(styles.actions)}>
        {saved && <span {...stylex.props(styles.saved)}>✓ Saved</span>}
        <button type="button" {...stylex.props(styles.save)}
          disabled={m.isPending || !isValidColourInput(value) || (custom !== "" && !customOk)}
          data-testid="colour-save"
          onClick={() => m.mutate()}>
          {m.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

const styles = stylex.create({
  wrap: { border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: colors.bgElev },
  row: { display: "flex", alignItems: "center", gap: "16px" },
  col: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  label: { fontSize: "13px", fontWeight: 600, color: colors.ink },
  help: { fontSize: "12.5px", color: colors.ink3, lineHeight: 1.45 },
  swatches: { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "8px", maxWidth: "560px", "@media (max-width: 720px)": { gridTemplateColumns: "repeat(6, 1fr)" } },
  swatch: { width: "32px", height: "32px", borderRadius: "999px", border: 0, padding: 0, cursor: "pointer" },
  swatchOn: {},
  customRow: { display: "flex", flexDirection: "column", gap: "6px", maxWidth: "320px" },
  input: { padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${colors.line}`, backgroundColor: colors.bg, color: colors.ink, fontSize: "13px", fontFamily: "inherit", boxSizing: "border-box" },
  warn: { fontSize: "12px", color: colors.danger },
  actions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" },
  saved: { fontSize: "12.5px", color: colors.positive, fontWeight: 500 },
  save: { padding: "8px 16px", borderRadius: radius.sm, border: 0, backgroundColor: colors.accent, color: colors.accentInk, cursor: "pointer", fontSize: "13px", fontWeight: 500, fontFamily: "inherit" },
});

import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";
import { glowShadow, hexFor } from "./personPalette";

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const styles = stylex.create({
  base: { borderRadius: "999px", flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", fontWeight: 600, lineHeight: 1, backgroundColor: colors.accent, color: colors.accentInk },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  size: (px: number) => ({ width: `${px}px`, height: `${px}px`, fontSize: `${Math.round(px * 0.42)}px` }),
  // F47 — the rounded identity glow. Two layered box-shadows: crisp inner ring + soft outer halo. The colour is the
  // person's stored value (palette key or hex), resolved by personPalette.hexFor at render time.
  glow: (sh: string) => ({ boxShadow: sh }),
});

/** A round person avatar — the photo when one is set, otherwise the initials on the indigo accent (AA-safe).
 *  Accepts an identity `colour` (palette key or hex); when set, renders a rounded glow ring tinted with it so the
 *  viewer recognises the person at a glance everywhere they appear (F47). */
export function Avatar({ name, photoUrl, size = 24, colour }: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  colour?: string | null;
}) {
  const hex = hexFor(colour ?? undefined);
  return (
    <span
      {...stylex.props(styles.base, styles.size(size), hex ? styles.glow(glowShadow(hex)) : null)}
      title={name}
      aria-label={`Assigned to ${name}`}
    >
      {photoUrl ? <img {...stylex.props(styles.img)} src={photoUrl} alt={name} /> : initials(name)}
    </span>
  );
}

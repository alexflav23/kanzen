import * as stylex from "@stylexjs/stylex";
import { colors } from "../styles/tokens.stylex";

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const styles = stylex.create({
  base: { borderRadius: "999px", flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", fontWeight: 600, lineHeight: 1, backgroundColor: colors.accent, color: colors.accentInk },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  size: (px: number) => ({ width: `${px}px`, height: `${px}px`, fontSize: `${Math.round(px * 0.42)}px` }),
});

/** A round person avatar — the photo when one is set, otherwise the initials on the indigo accent (AA-safe). */
export function Avatar({ name, photoUrl, size = 24 }: { name: string; photoUrl?: string | null; size?: number }) {
  return (
    <span {...stylex.props(styles.base, styles.size(size))} title={name} aria-label={`Assigned to ${name}`}>
      {photoUrl ? <img {...stylex.props(styles.img)} src={photoUrl} alt={name} /> : initials(name)}
    </span>
  );
}

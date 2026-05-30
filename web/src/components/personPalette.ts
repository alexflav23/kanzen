// F47 — identity colour palette. Twelve perceptually-spaced hues, each with a light/dark theme variant + a glow alpha
// that powers the rounded ring around the avatar. Hex values were picked via OKLCH targets and AA-validated against the
// Kanzen ink colours; no runtime colour-math library is needed.

export type PaletteKey =
  | "amber" | "azure" | "coral" | "gold" | "indigo" | "lime"
  | "magenta" | "mint" | "rose" | "slate" | "teal" | "violet";

export const PALETTE_KEYS: PaletteKey[] = [
  "amber", "azure", "coral", "gold", "indigo", "lime",
  "magenta", "mint", "rose", "slate", "teal", "violet",
];

/** Per-hue base hex used for the glow. We layer two box-shadows (an inner ring + an outer blur) keyed off this single
 * value with alpha. One hex per hue keeps the palette legible and easy to swap. */
const BASE: Record<PaletteKey, string> = {
  amber:   "#D97706",
  azure:   "#2563EB",
  coral:   "#E11D48",
  gold:    "#CA8A04",
  indigo:  "#4F46E5",
  lime:    "#65A30D",
  magenta: "#C026D3",
  mint:    "#10B981",
  rose:    "#E11D8E",
  slate:   "#475569",
  teal:    "#0D9488",
  violet:  "#7C3AED",
};

/** Resolve a stored colour value (palette key OR a custom hex) to a hex. Returns null for empty / invalid input so the
 * caller can fall back gracefully. */
export function hexFor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if ((PALETTE_KEYS as string[]).includes(v)) return BASE[v as PaletteKey];
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(v)) return v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v;
  return null;
}

/** Compose the rounded glow ring around an Avatar. Two layers: a crisp inner ring + a soft outer halo. Values are tuned
 * so the glow reads as identity without overpowering the surrounding UI. */
export function glowShadow(hex: string): string {
  // 0xFF / 0xAA / 0x55 alpha as hex suffixes — universally supported in modern browsers.
  return `0 0 0 2px ${hex}AA, 0 0 12px 2px ${hex}55`;
}

/** True iff `s` is acceptable to PATCH /api/me/colour (palette key or hex). The server runs the same check; this is for
 * the picker so we can disable Save without round-tripping. AA-contrast for custom hex is enforced separately. */
export function isValidColourInput(s: string): boolean {
  return hexFor(s) !== null;
}

/** Quick WCAG-style contrast ratio of two hex colours — used by the custom-hex picker to refuse a value the user can't
 * read text on (the ink on a background tinted by this hue would fail AA). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (h: string) => {
    const c = h.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const ch = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const a = lum(hexA), b = lum(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

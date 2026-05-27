import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import { colors } from "../styles/tokens.stylex";

// Brand loader — the 完 mark fills with ink from the bottom up, on a calm loop.
// Themed via the accent token (currentColor); SMIL drives the fill so it needs no JS.
const GLYPH_FONT = "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans CJK JP', 'Yu Gothic', sans-serif";

const styles = stylex.create({
  wrap: { display: "inline-grid", placeItems: "center", color: colors.accent },
});

export function KanzenLoader({ size = 44 }: { size?: number }) {
  const maskId = `kanzen-fill-${useId().replace(/[:]/g, "")}`;
  return (
    <span {...stylex.props(styles.wrap)} data-testid="kanzen-loader">
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Loading">
        <defs>
          <mask id={maskId}>
            {/* white reveals; the band rises from the baseline to the top, then holds, then loops */}
            <rect x="0" width="48" fill="#fff" y="48" height="0">
              <animate attributeName="y" dur="1.8s" repeatCount="indefinite" calcMode="spline"
                keyTimes="0;0.6;1" values="48;5;5" keySplines="0.45 0 0.2 1; 0 0 1 1" />
              <animate attributeName="height" dur="1.8s" repeatCount="indefinite" calcMode="spline"
                keyTimes="0;0.6;1" values="0;43;43" keySplines="0.45 0 0.2 1; 0 0 1 1" />
            </rect>
          </mask>
        </defs>
        {/* the empty glyph — a faint hairline outline (stroke only, no fill) */}
        <text aria-hidden="true" x="24" y="25" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight={700}
          fontFamily={GLYPH_FONT} fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.35}>完</text>
        {/* the ink filling in, clipped to the rising band */}
        <text aria-hidden="true" x="24" y="25" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight={700}
          fontFamily={GLYPH_FONT} fill="currentColor" mask={`url(#${maskId})`}>完</text>
      </svg>
    </span>
  );
}

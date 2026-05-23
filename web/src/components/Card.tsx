import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "../styles/tokens.stylex";

const styles = stylex.create({
  card: {
    border: `1px solid ${colors.line}`,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElev,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: `1px solid ${colors.line}`,
  },
  title: { fontSize: "14px", fontWeight: 600, color: colors.ink },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 20px",
    borderBottom: `1px solid ${colors.line}`,
  },
});

export function Card({ children, style }: { children: ReactNode; style?: stylex.StyleXStyles }) {
  return <section {...stylex.props(styles.card, style)}>{children}</section>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.header)}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <span {...stylex.props(styles.title)}>{children}</span>;
}

export function CardRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <div {...stylex.props(styles.row)} onClick={onClick} role={onClick ? "button" : undefined}>
      {children}
    </div>
  );
}

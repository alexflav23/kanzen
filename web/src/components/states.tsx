import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { colors, radius } from "../styles/tokens.stylex";
import { ApiError } from "../services/http";
import { KanzenLoader } from "./KanzenLoader";

const styles = stylex.create({
  panel: {
    border: `1px solid ${colors.line}`,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElev,
    padding: "40px 28px",
    textAlign: "center",
    color: colors.ink3,
    fontSize: "14px",
  },
  title: { fontSize: "16px", fontWeight: 600, color: colors.ink2, marginBottom: "6px" },
  detail: { fontSize: "13px", color: colors.ink3 },
  loaderWrap: { marginBottom: "10px" },
});

/** The four data states every wired list/detail renders (DoD: loading/empty/error/forbidden). */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div {...stylex.props(styles.panel)} role="status" aria-live="polite" data-testid="state-loading">
      <div {...stylex.props(styles.loaderWrap)}><KanzenLoader size={52} /></div>
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div {...stylex.props(styles.panel)} data-testid="state-empty">
      <div {...stylex.props(styles.title)}>{title}</div>
      {children && <div {...stylex.props(styles.detail)}>{children}</div>}
    </div>
  );
}

/** Renders the right thing for an `ApiError`: a 403 reads as "no access", anything
  * else as a retryable error. */
export function ErrorState({ error }: { error: unknown }) {
  const isForbidden = error instanceof ApiError && error.forbidden;
  const detail = error instanceof ApiError ? error.detail : "Something went wrong.";
  return (
    <div {...stylex.props(styles.panel)} role="alert" data-testid={isForbidden ? "state-forbidden" : "state-error"}>
      <div {...stylex.props(styles.title)}>{isForbidden ? "You don't have access to this" : "Couldn't load this"}</div>
      <div {...stylex.props(styles.detail)}>{detail}</div>
    </div>
  );
}

// Token-derived identity. The bearer JWT *is* the identity: it carries the effective
// principal's email + role (+ the real admin when impersonating). We decode the payload
// client-side purely to drive the UI synchronously with the token (nav gating, role-scoped
// reads) — there is NO signature verification here; the server remains the source of truth and
// enforces default-deny on every request. The claim names (`custom:role`, `email`,
// `impersonated_by`) are the same ones the backend verifier reads for both DevAuth and Cognito.

export type TokenClaims = {
  email: string | null;
  role: string | null;
  /** The user id (`sub`) — used to identify "your own" content in UI (e.g. click-to-edit your comments). */
  userId: string | null;
  /** The real admin's email when this session is an admin acting-as another user. */
  impersonatedBy: string | null;
};

function base64UrlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes); // handle UTF-8 (names/emails)
}

/** Decode the JWT payload into the identity claims the UI cares about. Returns null for an
 * absent or malformed token (→ default-deny in the UI; the server denies regardless). */
export function decodeToken(token: string | null): TokenClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
    return {
      email: str(json.email),
      role: str(json["custom:role"]),
      userId: str(json.sub),
      impersonatedBy: str(json.impersonated_by),
    };
  } catch {
    return null;
  }
}

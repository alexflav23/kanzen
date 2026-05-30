import { describe, expect, it } from "vitest";
import { decodeToken } from "../auth/claims";

// Build an unsigned JWT-shaped token (header.payload.sig) — the decoder reads claims only.
const jwt = (payload: Record<string, unknown>) => {
  const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(payload)}.sig`;
};

describe("decodeToken", () => {
  it("reads email + role (+ sub as userId) from the bearer's claims", () => {
    const c = decodeToken(jwt({ sub: "u1", email: "flavian@kanzen.local", "custom:role": "principal" }));
    expect(c).toEqual({ email: "flavian@kanzen.local", role: "principal", userId: "u1", impersonatedBy: null });
  });

  it("surfaces the real admin when impersonating", () => {
    const c = decodeToken(jwt({ email: "marcia@kanzen.local", "custom:role": "staff", impersonated_by: "flavian@kanzen.local" }));
    expect(c?.role).toBe("staff");
    expect(c?.impersonatedBy).toBe("flavian@kanzen.local");
  });

  it("returns null for an absent or malformed token (→ default-deny)", () => {
    expect(decodeToken(null)).toBeNull();
    expect(decodeToken("not-a-jwt")).toBeNull();
    expect(decodeToken("a.b.c")).toBeNull(); // payload isn't valid base64 JSON
  });
});

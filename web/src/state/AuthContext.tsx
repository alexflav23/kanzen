import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can as canFor, devToken, getMe, impersonate as impersonateSvc, type Me, type Persona } from "../services/auth";

type AuthState = {
  token: string | null;
  persona: Persona | null;
  me: Me | null;
  /** Resource-level permission check for the *effective* principal (recalibrates the UI). */
  can: (resource: string, level?: "read" | "write" | "admin") => boolean;
  /** True while /api/me is loading (so consumers can avoid flicker). */
  meLoading: boolean;
  /** True when the current session is an admin acting-as another user. */
  impersonating: boolean;
  signIn: (p: Persona) => Promise<void>;
  signOut: () => void;
  /** Admin act-as: swap the bearer to an impersonation token for `email`; re-fetches /api/me. */
  impersonate: (email: string) => Promise<void>;
  /** Restore the real admin's session. */
  stopImpersonating: () => void;
  setToken: (t: string | null) => void;
};

const TOKEN_KEY = "kanzen.token";
const PERSONA_KEY = "kanzen.persona";
const ADMIN_KEY = "kanzen.adminToken"; // the real admin's token, stashed during impersonation

const AuthCtx = createContext<AuthState | null>(null);

/** Holds the session: the bearer token + signed-in persona (localStorage), plus the *effective*
  * principal's permission set from /api/me. The whole UI recalibrates to whoever is authenticated
  * (or impersonated) via `can(...)`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [persona, setPersona] = useState<Persona | null>(() => {
    const raw = localStorage.getItem(PERSONA_KEY);
    return raw ? (JSON.parse(raw) as Persona) : null;
  });
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  // On any token change (sign-in, impersonation swap, reload) resolve the effective principal +
  // its permissions. Failure (no backend / bad token) leaves `me` null = default-deny.
  useEffect(() => {
    if (!token) { setMe(null); return; }
    let live = true;
    setMeLoading(true);
    getMe(token)
      .then((m) => { if (live) setMe(m); })
      .catch(() => { if (live) setMe(null); })
      .finally(() => { if (live) setMeLoading(false); });
    return () => { live = false; };
  }, [token]);

  const setToken = useCallback((t: string | null) => {
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
    setTokenState(t);
  }, []);

  const signIn = useCallback(async (p: Persona) => {
    const t = await devToken(p.email, p.role);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(PERSONA_KEY, JSON.stringify(p));
    setTokenState(t);
    setPersona(p);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSONA_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setTokenState(null);
    setPersona(null);
    setMe(null);
  }, []);

  const impersonate = useCallback(async (email: string) => {
    const current = localStorage.getItem(TOKEN_KEY);
    const t = await impersonateSvc(current, email);
    if (current && !localStorage.getItem(ADMIN_KEY)) localStorage.setItem(ADMIN_KEY, current); // stash the real admin token once
    setToken(t);
  }, [setToken]);

  const stopImpersonating = useCallback(() => {
    const admin = localStorage.getItem(ADMIN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    if (admin) setToken(admin);
  }, [setToken]);

  const can = useCallback(
    (resource: string, level: "read" | "write" | "admin" = "read") => (me ? canFor(me.permissions, resource, level) : false),
    [me],
  );
  const impersonating = !!me?.impersonatedBy;

  const value = useMemo<AuthState>(
    () => ({ token, persona, me, can, meLoading, impersonating, signIn, signOut, impersonate, stopImpersonating, setToken }),
    [token, persona, me, can, meLoading, impersonating, signIn, signOut, impersonate, stopImpersonating, setToken],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

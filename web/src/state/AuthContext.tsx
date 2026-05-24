import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { devToken, type Persona } from "../services/auth";

type AuthState = {
  token: string | null;
  persona: Persona | null;
  signIn: (p: Persona) => Promise<void>;
  signOut: () => void;
};

const TOKEN_KEY = "kanzen.token";
const PERSONA_KEY = "kanzen.persona";

const AuthCtx = createContext<AuthState | null>(null);

/** Holds the session: the bearer token + the signed-in persona, persisted to
  * localStorage. Dev sign-in mints a token from the backend; the Cognito redirect
  * replaces `signIn` later without changing consumers. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [persona, setPersona] = useState<Persona | null>(() => {
    const raw = localStorage.getItem(PERSONA_KEY);
    return raw ? (JSON.parse(raw) as Persona) : null;
  });

  const signIn = useCallback(async (p: Persona) => {
    const t = await devToken(p.email, p.role);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(PERSONA_KEY, JSON.stringify(p));
    setToken(t);
    setPersona(p);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSONA_KEY);
    setToken(null);
    setPersona(null);
  }, []);

  const value = useMemo<AuthState>(() => ({ token, persona, signIn, signOut }), [token, persona, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

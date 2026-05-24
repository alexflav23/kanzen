import { z } from "zod";
import { api } from "./http";

export type Role = "principal" | "manager" | "staff";
export type Persona = { name: string; email: string; role: Role };

/** The real household personas (mirror the V2_21 seed). Used by the dev sign-in until
  * the Cognito hosted UI lands; the role flows into the backend's default-deny Authorizer. */
export const PERSONAS: Persona[] = [
  { name: "Toby", email: "toby@kanzen.local", role: "principal" },
  { name: "Lorna", email: "lorna@kanzen.local", role: "manager" },
  { name: "Marcia", email: "marcia@kanzen.local", role: "staff" },
  { name: "Siti", email: "siti@kanzen.local", role: "staff" },
];

const TokenSchema = z.object({ token: z.string(), note: z.string() });

/** DEV sign-in: ask the backend to mint a local JWT for a persona. Replaced by the
  * Cognito hosted-UI redirect once a pool exists. */
export function devToken(email: string, role: string): Promise<string> {
  return api("/api/dev/token", TokenSchema, { method: "POST", body: { email, role } }).then((r) => r.token);
}

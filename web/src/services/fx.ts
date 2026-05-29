import { z } from "zod";
import { api } from "./http";

// F37 — active currencies (code + symbol + decimals). Native amounts are the truth; FX is an overlay.
export const CurrencySchema = z.object({ code: z.string(), symbol: z.string().nullable(), decimals: z.number() });
export type Currency = z.infer<typeof CurrencySchema>;

export const listCurrencies = (token: string | null) => api("/api/currencies", z.array(CurrencySchema), { token });

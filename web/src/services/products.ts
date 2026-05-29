import { z } from "zod";
import { api } from "./http";

// F35 — consumables/supplies: stock status + the right spec + where to buy.
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  stockStatus: z.enum(["in_stock", "low", "out"]),
  preferredSpec: z.string().nullable(),
  unit: z.string().nullable(),
  vendor: z.string().nullable(),
  buyUrl: z.string().nullable(),
  needsReorder: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

export const listProducts = (token: string | null) => api("/api/products", z.array(ProductSchema), { token });

export const createProduct = (name: string, preferredSpec: string | null, unit: string | null, token: string | null) =>
  api("/api/products", ProductSchema, { method: "POST", body: { name, preferredSpec, unit }, token });

/** Set stock status — out/low emits an F34 event (the buy-request path, F35 §6). */
export const setStock = (id: string, status: Product["stockStatus"], token: string | null) =>
  api(`/api/products/${id}/stock`, ProductSchema, { method: "POST", body: { status }, token });

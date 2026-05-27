import { z } from "zod";
import { api } from "./http";

export const ListSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor: z.string().nullable(),
  propertyId: z.string().nullable(),
  type: z.string(),
  cycle: z.string().nullable(),
  nextOrder: z.string().nullable(), // ISO date (LocalDate) or null
  status: z.string(),
});
export type ShoppingList = z.infer<typeof ListSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.number(),
  status: z.string(),
  recurring: z.boolean(),
  url: z.string().nullable(),
  category: z.string().nullable(),
  note: z.string().nullable(),
  estPriceMinor: z.number().nullable(),
  currency: z.string().nullable(),
  addedBy: z.string().nullable(),
});
export type ListItem = z.infer<typeof ItemSchema>;

export type NewItem = {
  name: string;
  qty?: number;
  recurring?: boolean;
  url?: string | null;
  category?: string | null;
  note?: string | null;
  estPriceMinor?: number | null;
};

export const listLists = (token: string | null) => api("/api/lists", z.array(ListSchema), { token });
export const listItems = (listId: string, token: string | null) =>
  api(`/api/lists/${listId}/items`, z.array(ItemSchema), { token });

export const addItem = (listId: string, item: NewItem, token: string | null) =>
  api(`/api/lists/${listId}/items`, ItemSchema, {
    method: "POST",
    body: {
      name: item.name,
      qty: item.qty ?? 1,
      recurring: item.recurring ?? false,
      url: item.url ?? null,
      category: item.category ?? null,
      note: item.note ?? null,
      estPriceMinor: item.estPriceMinor ?? null,
    },
    token,
  });

export const approveItem = (id: string, token: string | null) =>
  api(`/api/list-items/${id}/approve`, z.unknown(), { method: "POST", token });
export const declineItem = (id: string, token: string | null) =>
  api(`/api/list-items/${id}/decline`, z.unknown(), { method: "POST", token });
export const placeOrder = (listId: string, token: string | null) =>
  api(`/api/lists/${listId}/order`, z.unknown(), { method: "POST", token });
export const createList = (
  body: { name: string; vendor: string | null; propertyId: string | null },
  token: string | null,
) => api("/api/lists", ListSchema, { method: "POST", body, token });

export type EditListReq = { name: string; vendor: string | null; propertyId: string | null; cycle: string | null; nextOrder: string | null; type: string };

/** Reconfigure a list — property, vendor, ordering cadence + next-order, type (Manager+). */
export const editList = (id: string, body: EditListReq, token: string | null) =>
  api(`/api/lists/${id}`, ListSchema, { method: "PATCH", body, token });

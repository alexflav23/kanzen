import { z } from "zod";
import { api } from "./http";

export const ListSchema = z.object({ id: z.string(), name: z.string(), vendor: z.string().nullable(), propertyId: z.string().nullable() });
export type ShoppingList = z.infer<typeof ListSchema>;

export const ItemSchema = z.object({ id: z.string(), name: z.string(), qty: z.number(), status: z.string(), recurring: z.boolean(), url: z.string().nullable() });
export type ListItem = z.infer<typeof ItemSchema>;

export const listLists = (token: string | null) => api("/api/lists", z.array(ListSchema), { token });
export const listItems = (listId: string, token: string | null) => api(`/api/lists/${listId}/items`, z.array(ItemSchema), { token });
export const addItem = (listId: string, name: string, token: string | null) =>
  api(`/api/lists/${listId}/items`, ItemSchema, { method: "POST", body: { name, qty: 1, recurring: false, url: null }, token });
export const approveItem = (id: string, token: string | null) => api(`/api/list-items/${id}/approve`, z.unknown(), { method: "POST", token });
export const declineItem = (id: string, token: string | null) => api(`/api/list-items/${id}/decline`, z.unknown(), { method: "POST", token });

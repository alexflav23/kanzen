import { z } from "zod";
import { api } from "./http";

/** F04 — asset category node (mirrors api.Assets.CategoryView). */
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

export function listCategories(token: string | null): Promise<Category[]> {
  return api("/api/categories", z.array(CategorySchema), { token });
}

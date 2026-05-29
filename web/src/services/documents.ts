import { z } from "zod";
import { api } from "./http";

/** F05 — a document (mirrors api.Documents.DocumentView). */
export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  contentType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  sha256: z.string().nullable(),
  visibility: z.string(),
  source: z.string(),
  propertyId: z.string().nullable(),
  immutable: z.boolean(),
  createdAt: z.string(),
});
export type Document = z.infer<typeof DocumentSchema>;

const PresignSchema = z.object({ url: z.string(), expiresInSeconds: z.number() });
/** A short-lived presigned URL to open/preview/download a document's immutable original. */
export const documentDownloadUrl = (id: string, token: string | null) =>
  api(`/api/documents/${id}/download`, PresignSchema, { token });

const UploadResultSchema = z.object({ document: DocumentSchema, deduped: z.boolean() });
export type UploadResult = z.infer<typeof UploadResultSchema>;

export type UploadReq = {
  name: string;
  category: string;
  contentType: string;
  contentBase64: string;
  visibility?: string;
  source?: string;
  propertyId?: string | null;
};

export function listDocuments(token: string | null, category?: string | null, q?: string | null): Promise<Document[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const qs = params.toString();
  return api(`/api/documents${qs ? `?${qs}` : ""}`, z.array(DocumentSchema), { token });
}

export function uploadDocument(req: UploadReq, token: string | null): Promise<UploadResult> {
  return api("/api/documents", UploadResultSchema, { method: "POST", body: req, token });
}

/** Read a browser File as raw base64 (strips the data: URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** A document attached to a target, with a presigned URL ready to render (galleries/thumbnails). */
export const LinkedDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  url: z.string(),
  expiresInSeconds: z.number(),
});
export type LinkedDoc = z.infer<typeof LinkedDocSchema>;

/** Documents attached to a target (e.g. a list item), each with a presigned URL. */
export function documentsFor(targetType: string, targetId: string, token: string | null): Promise<LinkedDoc[]> {
  return api(`/api/documents/for/${targetType}/${targetId}`, z.array(LinkedDocSchema), { token });
}

/** Attach an existing document to a target (polymorphic link). */
export function linkDocument(
  id: string,
  targetType: string,
  targetId: string,
  token: string | null,
  role?: string | null,
): Promise<unknown> {
  return api(`/api/documents/${id}/links`, z.unknown(), {
    method: "POST",
    body: { targetType, targetId, role: role ?? null },
    token,
  });
}

/** Detach a document from a target (the original is retained). */
export function unlinkDocument(id: string, targetType: string, targetId: string, token: string | null): Promise<unknown> {
  return api(`/api/documents/${id}/links/${targetType}/${targetId}`, z.unknown(), { method: "DELETE", token });
}

/** Delete a document from a target: unlinks, and soft-deletes the document if no links remain
 * (dedup-safe — a photo shared with another asset survives). The immutable original is retained. */
export function removePhoto(id: string, targetType: string, targetId: string, token: string | null): Promise<unknown> {
  return api(`/api/documents/${id}/from/${targetType}/${targetId}`, z.unknown(), { method: "DELETE", token });
}

/** Upload a file and link it to a target in one shot — returns the new document id. */
export async function uploadAndLink(
  file: File,
  targetType: string,
  targetId: string,
  token: string | null,
  opts?: { category?: string; propertyId?: string | null },
): Promise<string> {
  const contentBase64 = await fileToBase64(file);
  const { document } = await uploadDocument(
    {
      name: file.name,
      category: opts?.category ?? "photo",
      contentType: file.type || "application/octet-stream",
      contentBase64,
      propertyId: opts?.propertyId ?? null,
    },
    token,
  );
  await linkDocument(document.id, targetType, targetId, token);
  return document.id;
}

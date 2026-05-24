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
});
export type Document = z.infer<typeof DocumentSchema>;

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

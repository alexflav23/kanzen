import type { z } from "zod";

/** Base URL of the Kanzen API. Overridable via VITE_API_URL; defaults to the local backend. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

/** A typed API failure. `status` 0 = the network/server was unreachable. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ApiError";
  }
  get unauthorized(): boolean { return this.status === 401; }
  get forbidden(): boolean { return this.status === 403; }
}

type Opts = { token?: string | null; method?: string; body?: unknown };

/** Fetch JSON and validate it at the boundary with Zod. Maps non-2xx to `ApiError`
  * (reading the backend's `{status,code,detail}` shape), and network failures to
  * `ApiError(0,"network")`. The only place the app talks to the backend. */
export async function api<T>(path: string, schema: z.ZodType<T>, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the Kanzen API.");
  }

  if (!res.ok) {
    let code = "error";
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as Partial<{ code: string; detail: string }>;
      if (body.code) code = body.code;
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, detail);
  }

  return schema.parse(await res.json());
}

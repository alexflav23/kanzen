import { afterEach, describe, expect, it, vi } from "vitest";
import { listProperties } from "../properties";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, body: unknown) =>
  ({ ok: false, status, statusText: "", json: async () => body }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("properties service (Zod boundary + error mapping)", () => {
  it("parses a valid response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok([{ id: "1", name: "Wardian", jurisdiction: "GB", currency: "GBP", status: "active", rooms: 4, assets: 12, bills: 3, vendors: 5 }])));
    const ps = await listProperties("t");
    expect(ps).toHaveLength(1);
    expect(ps[0].currency).toBe("GBP");
    expect(ps[0].vendors).toBe(5);
  });

  it("maps a 403 to a forbidden ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fail(403, { status: 403, code: "forbidden", detail: "no read access" })));
    await expect(listProperties("t")).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("maps a network failure to ApiError(0)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(listProperties("t")).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("rejects a malformed payload (Zod)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok([{ id: 1 }])));
    await expect(listProperties("t")).rejects.toBeInstanceOf(Error);
  });
});

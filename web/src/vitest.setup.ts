import "@testing-library/jest-dom";
import { vi } from "vitest";

// Unit tests are network-free: any service call that isn't explicitly mocked must NOT reach a real
// backend (one may be running locally on :28080, which would make tests pass/fail by environment).
// Reject by default → unmocked calls surface as ApiError(0,"network"); service tests stubGlobal fetch.
globalThis.fetch = vi.fn(() =>
  Promise.reject(new Error("network disabled in unit tests")),
) as unknown as typeof fetch;

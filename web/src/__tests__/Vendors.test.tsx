import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import type { Vendor } from "../services/vendors";

const VENDORS: Vendor[] = [
  { id: "1", name: "Thames Plumbing", type: "business", trade: "plumber", ndaUntil: null, insuranceUntil: new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10), rating: null },
  { id: "2", name: "Volt Electrics", type: "business", trade: "electrician", ndaUntil: null, insuranceUntil: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10), rating: null },
];

vi.mock("../services/vendors", () => ({
  listVendors: vi.fn(async () => VENDORS),
  createVendor: vi.fn(),
}));

import { Vendors } from "../pages/Vendors";

const renderVendors = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Vendors /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Vendors", () => {
  it("lists vendors from the API", async () => {
    renderVendors();
    expect(await screen.findAllByTestId("vendor-row")).toHaveLength(2);
    expect(screen.getByText("Thames Plumbing")).toBeInTheDocument();
  });

  it("flags an expired-insurance vendor", async () => {
    renderVendors();
    await screen.findAllByTestId("vendor-row");
    expect(screen.getByText("Insurance expired")).toBeInTheDocument();
  });
});

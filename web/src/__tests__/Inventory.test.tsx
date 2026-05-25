import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import type { AssetView } from "../services/assets";

const WATCHES = "30000000-0000-0000-0000-000000000001";
const ALL: AssetView[] = [
  { id: "a1", title: "Royal Oak 15500ST", maker: "Audemars Piguet", categoryId: WATCHES, trackingMode: "unique", quantity: 1, ownershipStatus: "owned" },
  { id: "a2", title: "1959 Les Paul Standard", maker: "Gibson", categoryId: "guitars", trackingMode: "unique", quantity: 1, ownershipStatus: "owned" },
  { id: "a3", title: "Crystal Tumblers", maker: "Cumbria", categoryId: "glass", trackingMode: "grouped_quantity", quantity: 6, ownershipStatus: "owned" },
];

vi.mock("../services/assets", () => ({
  // honour the faceted params so the rail/search behave like the real API
  listAssets: vi.fn(async (_t: string | null, category?: string | null, q?: string | null) => {
    let r = ALL;
    if (category) r = r.filter((a) => a.categoryId === category);
    if (q) r = r.filter((a) => `${a.title} ${a.maker}`.toLowerCase().includes(q.toLowerCase()));
    return r;
  }),
}));
vi.mock("../services/categories", () => ({
  listCategories: vi.fn(async () => [{ id: WATCHES, name: "Watches", parentId: null }]),
}));
vi.mock("../services/insights", () => ({
  // avg(67,100,33,50) = 62.5 → 63%
  getRegistryHealth: vi.fn(async () => ({ total: 3, photographedPct: 67, categorisedPct: 100, locatedPct: 33, proofPct: 50 })),
}));

import { Inventory } from "../pages/Inventory";
import { listAssets } from "../services/assets";

const renderInv = (props: { vertical?: string; label?: string } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Inventory {...props} /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Inventory", () => {
  it("lists the assets from the API", async () => {
    renderInv();
    expect(await screen.findAllByTestId("asset-card")).toHaveLength(3);
  });

  it("a vertical narrows the same generic surface (Vehicles = 'vehicle' vertical)", async () => {
    renderInv({ vertical: "vehicle", label: "Vehicles" });
    expect(await screen.findByRole("heading", { name: "Vehicles" })).toBeInTheDocument();
    await screen.findAllByTestId("asset-card");
    expect(listAssets).toHaveBeenCalledWith("t", null, "", "vehicle");
  });

  it("shows real registry completeness from the health aggregate", async () => {
    renderInv();
    expect(await screen.findByText("63%")).toBeInTheDocument(); // avg of the four checks
    expect(await screen.findByText("Data quality")).toBeInTheDocument(); // the rail nudge
  });

  it("filters by a category from the rail", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    fireEvent.click(await screen.findByRole("button", { name: "Watches" }));
    expect(await screen.findByText("Royal Oak 15500ST")).toBeInTheDocument();
    expect(screen.queryByText("1959 Les Paul Standard")).not.toBeInTheDocument();
  });

  it("searches by maker", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    fireEvent.change(screen.getByLabelText("Search inventory"), { target: { value: "Gibson" } });
    expect(await screen.findByText("1959 Les Paul Standard")).toBeInTheDocument();
    expect(screen.queryByText("Royal Oak 15500ST")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/insights", () => ({
  getRegistryHealth: async () => ({ total: 10, photographedPct: 20, categorisedPct: 80, locatedPct: 60, proofPct: 30 }),
  getRegistryAnalytics: async () => ({
    assetTotal: 10,
    lifetimeSpendMinor: 27500000,
    byCategory: [{ category: "Art", totalMinor: 9200000 }, { category: "Watches", totalMinor: 5165000 }],
    topAssets: [{ title: "La Colombe", maker: "Picasso", valueMinor: 9200000 }, { title: "Royal Oak", maker: "AP", valueMinor: 4200000 }],
    spendByMonth: [{ month: "2026-04", currency: "GBP", totalMinor: 184020 }, { month: "2026-05", currency: "GBP", totalMinor: 320000 }],
  }),
  listQualityFlags: async () => [
    { id: "f1", assetId: "a1", assetTitle: "Royal Oak", kind: "missing_proof", severity: "medium" },
    { id: "f2", assetId: "a2", assetTitle: "Daytona", kind: "expensive_no_proof", severity: "high" },
  ],
  runScan: vi.fn(async () => ({ flagsRaised: 2 })),
  resolveFlag: vi.fn(async () => ({ ok: true })),
}));

import { Insights } from "../pages/Insights";

const renderInsights = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Insights /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Insights", () => {
  it("shows registry-health bars and the data-quality flag stream", async () => {
    renderInsights();
    expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
    // F29 analytics: KPIs + value-by-category + top assets (real aggregation)
    expect(await screen.findByTestId("insight-kpis")).toBeInTheDocument();
    expect(screen.getByTestId("by-category")).toBeInTheDocument();
    expect(screen.getAllByTestId("cat-row")).toHaveLength(2);
    expect(screen.getByText("Art")).toBeInTheDocument();
    expect(screen.getAllByTestId("top-asset").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("La Colombe")).toBeInTheDocument();
    // F23 registry-health bars
    expect(screen.getByTestId("registry-health")).toBeInTheDocument();
    expect(screen.getAllByTestId("health-bar")).toHaveLength(4);
    expect(screen.getByText("80%")).toBeInTheDocument(); // categorised
    expect(await screen.findAllByTestId("flag-row")).toHaveLength(2);
    expect(screen.getByText("expensive no proof")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeInTheDocument();
    // F29 spend-trend: a bar per GBP month
    expect(screen.getByTestId("spend-trend")).toBeInTheDocument();
    expect(screen.getAllByTestId("spend-bar")).toHaveLength(2);
  });
});

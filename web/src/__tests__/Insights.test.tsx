import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/insights", () => ({
  getRegistryHealth: async () => ({ total: 10, photographedPct: 20, categorisedPct: 80, locatedPct: 60, proofPct: 30 }),
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
    expect(await screen.findByTestId("registry-health")).toBeInTheDocument();
    expect(screen.getAllByTestId("health-bar")).toHaveLength(4);
    expect(screen.getByText("80%")).toBeInTheDocument(); // categorised
    expect(await screen.findAllByTestId("flag-row")).toHaveLength(2);
    expect(screen.getByText("expensive no proof")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeInTheDocument();
  });
});

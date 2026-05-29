import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const { recordSell } = vi.hoisted(() => ({ recordSell: vi.fn(async () => ({ quantitySold: 5, proceedsMinor: 50000, costBasisMinor: 45000, realizedGainMinor: 5000 })) }));
vi.mock("../services/wealth", () => ({
  listEntities: async () => [
    { id: "e1", name: "Flavian (Individual)", kind: "individual", jurisdiction: "UK", baseCurrency: "GBP", parentEntityId: null },
  ],
  getNetWorth: async () => ({ entityId: null, cashAndOtherMinor: 500000, investmentsMinor: 98000, assetsMinor: 598000, liabilitiesMinor: 0, netMinor: 598000 }),
  getBalanceSheet: async () => ({ entityId: null, assetsMinor: 598000, liabilitiesMinor: 0, equityMinor: 598000, balances: true }),
  listHoldings: async () => [
    { securityId: "s1", symbol: "VWRL", quantity: 10, costBasisMinor: 90000, marketValueMinor: 98000, unrealizedGainMinor: 8000 },
  ],
  getIncomeStatement: async () => ({ entityId: null, from: "2026-01-01", to: "2026-05-28", incomeMinor: 1200000, expenseMinor: 450000, netMinor: 750000 }),
  listSecurities: async () => [{ id: "s1", symbol: "VWRL", name: "Vanguard FTSE All-World", currency: "GBP", assetClass: "equity" }],
  recordBuy: vi.fn(async () => ({ id: "lot1" })),
  recordSell,
  createSecurity: vi.fn(),
}));

import { Wealth } from "../pages/Wealth";

const renderWealth = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><Wealth /></AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Wealth", () => {
  it("shows the consolidated net worth, a holding with its unrealised gain, and a balanced sheet", async () => {
    renderWealth();
    expect(screen.getByRole("heading", { name: "Net worth" })).toBeInTheDocument();
    // £5,980 net (598000 minor); a VWRL holding with +£80 unrealised
    expect(await screen.findByTestId("networth-net")).toHaveTextContent("£5,980");
    expect(await screen.findByText("VWRL")).toBeInTheDocument();
    expect(screen.getByText("+£80")).toBeInTheDocument();
    expect(screen.getByText("balanced")).toBeInTheDocument();
  });

  it("shows the income statement for the period and offers a CSV export", async () => {
    renderWealth();
    expect(await screen.findByTestId("income-statement")).toBeInTheDocument();
    expect(screen.getByTestId("is-income")).toHaveTextContent("£12,000"); // 1,200,000 minor
    expect(screen.getByTestId("is-net")).toHaveTextContent("£7,500"); // income − expenses
    expect(screen.getByRole("button", { name: "Export statement CSV" })).toBeInTheDocument();
  });

  it("records a sell trade and surfaces the realised gain", async () => {
    renderWealth();
    fireEvent.click(await screen.findByRole("button", { name: "Record trade" }));
    const modal = await screen.findByTestId("trade-modal");
    fireEvent.click(within(modal).getByRole("tab", { name: "Sell" }));
    fireEvent.change(within(modal).getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.change(within(modal).getByLabelText("Proceeds"), { target: { value: "500.00" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Record sell" }));
    await waitFor(() => expect(recordSell).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "e1", securityId: "s1", quantity: 5, proceedsMinor: 50000 }), "t",
    ));
    expect(await screen.findByTestId("trade-result")).toHaveTextContent("+£50"); // realised gain (5000 minor)
  });
});

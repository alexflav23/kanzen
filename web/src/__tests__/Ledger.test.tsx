import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/wealth", () => ({
  listAccounts: vi.fn(async () => [
    { id: "a1", code: "toby-cash", name: "Coutts current", accountType: "asset", currency: "GBP", balanceMinor: 500000, subkind: null },
    { id: "a2", code: "toby-equity", name: "Opening equity", accountType: "equity", currency: "GBP", balanceMinor: -500000, subkind: null },
  ]),
}));
const accountRegister = vi.hoisted(() => vi.fn(async () => [
  { transactionId: "t1", kind: "opening_balance", description: "Opening balance", occurredOn: "2026-01-01", amountMinor: 500000, memo: "opening cash" },
]));
vi.mock("../services/ledger", () => ({ accountRegister }));

import { Ledger } from "../pages/Ledger";

const renderLedger = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><Ledger /></AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => { localStorage.setItem("kanzen.token", "t"); accountRegister.mockClear(); });

describe("Ledger (Statements)", () => {
  it("lists the chart of accounts and shows the first account's register by default", async () => {
    renderLedger();
    expect(await screen.findAllByTestId("account-row")).toHaveLength(2);
    expect(screen.getByText("Coutts current")).toBeInTheDocument();
    // first account's register loads automatically
    expect(await screen.findByTestId("register-row")).toBeInTheDocument();
    expect(screen.getByText("Opening balance")).toBeInTheDocument();
    expect(accountRegister).toHaveBeenCalledWith("a1", "t");
  });

  it("selecting another account loads its register", async () => {
    renderLedger();
    await screen.findAllByTestId("account-row");
    fireEvent.click(screen.getByText("Opening equity"));
    await vi.waitFor(() => expect(accountRegister).toHaveBeenCalledWith("a2", "t"));
  });
});

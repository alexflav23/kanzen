import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const list = {
  id: "l1",
  name: "Grocery — Wardian",
  vendor: "Waitrose",
  propertyId: "p1",
  type: "grocery",
  cycle: "weekly",
  nextOrder: "2026-05-28",
  status: "active",
};

vi.mock("../services/lists", () => ({
  listLists: vi.fn(async () => [list]),
  listItems: vi.fn(async () => [
    { id: "i1", name: "Whole milk", qty: 2, status: "added", recurring: true, url: null, category: "Dairy", note: null, estPriceMinor: null, currency: null, addedBy: "Marcia" },
    { id: "i2", name: "Truffle (fresh)", qty: 1, status: "needs_approval", recurring: false, url: null, category: "Produce", note: "For the weekend", estPriceMinor: 9500, currency: "GBP", addedBy: "Marcia" },
  ]),
  addItem: vi.fn(),
  approveItem: vi.fn(),
  declineItem: vi.fn(),
  placeOrder: vi.fn(),
  createList: vi.fn(),
}));
vi.mock("../services/properties", () => ({
  listProperties: vi.fn(async () => [{ id: "p1", name: "Wardian Apt 5206", jurisdiction: "UK", currency: "GBP", status: "active", rooms: 0, assets: 0, bills: 0, vendors: 0 }]),
}));

import { Lists } from "../pages/Lists";

const renderLists = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Lists /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Flavian", email: "flavian@kanzen.local", role: "principal" }));
});

describe("Lists", () => {
  it("renders master-detail with confirmed items grouped + the approval queue", async () => {
    renderLists();
    // The list name shows in both the rail and the detail header.
    expect((await screen.findAllByText("Grocery — Wardian")).length).toBeGreaterThan(0);
    // Confirmed staple appears as a checkable item row; the £95 truffle is an approval-queue row.
    expect(await screen.findByTestId("list-item-row")).toHaveTextContent("Whole milk");
    expect(await screen.findByTestId("approval-row")).toHaveTextContent("Truffle (fresh)");
    expect(screen.getByText(/est\. £95/)).toBeInTheDocument();
    expect(screen.getByText(/1 need approval/)).toBeInTheDocument();
    // Principal can approve + place the order.
    expect(screen.getByRole("button", { name: "Approve Truffle (fresh)" })).toBeInTheDocument();
    expect(screen.getByTestId("place-order")).toBeInTheDocument();
  });
});

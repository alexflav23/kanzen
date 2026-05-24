import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/lists", () => ({
  listLists: vi.fn(async () => [{ id: "l1", name: "Weekly groceries", vendor: "Waitrose", propertyId: null }]),
  listItems: vi.fn(async () => [
    { id: "i1", name: "Whole milk", qty: 2, status: "added", recurring: true, url: null },
    { id: "i2", name: "Coffee beans", qty: 1, status: "needs_approval", recurring: false, url: null },
  ]),
  addItem: vi.fn(),
  approveItem: vi.fn(),
  declineItem: vi.fn(),
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
  it("renders a list with its items and the needs-approval flag", async () => {
    renderLists();
    expect(await screen.findByText("Weekly groceries · Waitrose")).toBeInTheDocument();
    expect(await screen.findAllByTestId("list-item-row")).toHaveLength(2);
    expect(screen.getByText("needs approval")).toBeInTheDocument();
  });
});

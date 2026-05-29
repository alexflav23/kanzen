import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/products", () => ({
  listProducts: vi.fn(async () => [
    { id: "p1", name: "Nespresso pods", stockStatus: "low", preferredSpec: "Arpeggio", unit: "box", vendor: "Nespresso", buyUrl: "https://x/y", needsReorder: true },
    { id: "p2", name: "Dishwasher tablets", stockStatus: "in_stock", preferredSpec: "Finish", unit: "box", vendor: "Ocado", buyUrl: null, needsReorder: false },
    { id: "p3", name: "Olive oil", stockStatus: "out", preferredSpec: "Frantoia", unit: "bottle", vendor: "Natoora", buyUrl: "https://n/o", needsReorder: true },
  ]),
  createProduct: vi.fn(),
  setStock: vi.fn(),
}));

import { Products } from "../pages/Products";

const renderP = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Products /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Supplies", () => {
  it("lists the shelf with spec/unit/vendor and a reorder count", async () => {
    renderP();
    expect(await screen.findAllByTestId("product-row")).toHaveLength(3);
    expect(screen.getByText("Olive oil")).toBeInTheDocument();
    expect(screen.getByText(/Frantoia · bottle · Natoora/)).toBeInTheDocument();
    // 2 of 3 (Nespresso low + Olive oil out) need reordering
    expect(screen.getByTestId("reorder-banner")).toHaveTextContent("2 items need reordering");
  });
});

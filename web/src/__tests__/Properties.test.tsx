import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/properties", () => ({
  listProperties: vi.fn(async () => [
    { id: "20000000-0000-0000-0000-000000000001", name: "Wardian — Apt 5206", jurisdiction: "GB", currency: "GBP", status: "active", rooms: 4, assets: 12, bills: 3, vendors: 5 },
    { id: "20000000-0000-0000-0000-000000000002", name: "Singapore Residence", jurisdiction: "SG", currency: "SGD", status: "active", rooms: 6, assets: 20, bills: 2, vendors: 3 },
  ]),
}));

import { Properties } from "../pages/Properties";

const renderProps = () => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter><Properties /></MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  localStorage.setItem("kanzen.token", "dev.token");
});

// UI test (Vitest): the Properties cover cards, fed by the (mocked) API service.
describe("Properties", () => {
  it("renders a card per property from the API", async () => {
    renderProps();
    expect(await screen.findAllByTestId("property-card")).toHaveLength(2);
  });

  it("shows the seeded properties", async () => {
    renderProps();
    expect(await screen.findByText("Wardian — Apt 5206")).toBeInTheDocument();
    expect(await screen.findByText("Singapore Residence")).toBeInTheDocument();
  });

  it("shows the per-property counts on each card", async () => {
    renderProps();
    // the prototype's four tiles, fed by the API counts
    expect(await screen.findAllByText("Rooms")).toHaveLength(2);
    expect(await screen.findAllByText("Bills")).toHaveLength(2);
    expect(await screen.findByText("12")).toBeInTheDocument(); // Wardian assets
  });
});

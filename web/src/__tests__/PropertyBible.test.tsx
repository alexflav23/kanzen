import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/properties", () => ({
  getProperty: vi.fn(async () => ({
    id: "p1", name: "Wardian — Apt 5206", jurisdiction: "GB", currency: "GBP", status: "active",
    rooms: 2, assets: 0, bills: 0, vendors: 0,
  })),
}));
vi.mock("../services/locations", () => ({
  listLocations: vi.fn(async () => [
    { id: "l1", parentId: null, kind: "room", name: "Living room", floor: "52", area: "42 m²", notes: null },
    { id: "l2", parentId: "l1", kind: "cabinet", name: "Drinks cabinet", floor: null, area: null, notes: null },
  ]),
}));
vi.mock("../services/defects", () => ({
  listDefects: vi.fn(async () => [
    { id: "d1", propertyId: "p1", locationId: null, title: "Leaking tap", description: "drips", severity: "medium", status: "open", reportedBy: null },
  ]),
}));

import { PropertyBible } from "../pages/PropertyBible";

const renderBible = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/properties/p1"]}>
          <Routes><Route path="/properties/:id" element={<PropertyBible />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("PropertyBible", () => {
  it("renders the overview from the detail aggregate", async () => {
    renderBible();
    expect(await screen.findByText("Wardian — Apt 5206")).toBeInTheDocument();
    expect(screen.getByText("Jurisdiction")).toBeInTheDocument();
  });

  it("shows the nested room tree under the Rooms tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Rooms" }));
    expect(await screen.findByText("Living room")).toBeInTheDocument();
    expect(screen.getByText("Drinks cabinet")).toBeInTheDocument();
  });

  it("lists defects under the Defects tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Defects" }));
    expect(await screen.findByText("Leaking tap")).toBeInTheDocument();
  });
});

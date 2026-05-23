import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Inventory } from "../pages/Inventory";

const renderInv = () => render(<MemoryRouter><Inventory /></MemoryRouter>);

// UI test (Vitest): the Inventory registry — stats, filter rail, search.
describe("Inventory", () => {
  it("lists all assets initially", () => {
    renderInv();
    expect(screen.getAllByTestId("asset-card")).toHaveLength(8);
  });

  it("filters by a category from the rail", () => {
    renderInv();
    fireEvent.click(screen.getByRole("button", { name: /Watches/ }));
    expect(screen.getAllByTestId("asset-card")).toHaveLength(2);
    expect(screen.getByText("Royal Oak")).toBeInTheDocument();
    expect(screen.getByText("Nautilus 5711")).toBeInTheDocument();
  });

  it("searches by maker", () => {
    renderInv();
    fireEvent.change(screen.getByLabelText("Search inventory"), { target: { value: "Picasso" } });
    expect(screen.getAllByTestId("asset-card")).toHaveLength(1);
    expect(screen.getByText("La Colombe")).toBeInTheDocument();
  });
});

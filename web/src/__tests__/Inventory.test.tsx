import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inventory } from "../pages/Inventory";

// UI test (Vitest): the Inventory grid renders and filters by category.
describe("Inventory", () => {
  it("lists all assets initially", () => {
    render(<Inventory />);
    expect(screen.getAllByTestId("asset-card")).toHaveLength(4);
  });

  it("filters to a single category", () => {
    render(<Inventory />);
    fireEvent.click(screen.getByRole("button", { name: "Watches" }));
    expect(screen.getAllByTestId("asset-card")).toHaveLength(1);
    expect(screen.getByText("Royal Oak")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Properties } from "../pages/Properties";

// UI test (Vitest): the Properties cards.
describe("Properties", () => {
  it("renders a card per property", () => {
    render(<Properties />);
    expect(screen.getAllByTestId("property-card")).toHaveLength(2);
  });

  it("shows the seed properties", () => {
    render(<Properties />);
    expect(screen.getByText("Wardian, Apt 5206")).toBeInTheDocument();
    expect(screen.getByText("Singapore", { exact: true })).toBeInTheDocument();
  });
});

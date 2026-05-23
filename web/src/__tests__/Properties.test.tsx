import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Properties } from "../pages/Properties";

const renderProps = () => render(<MemoryRouter><Properties /></MemoryRouter>);

// UI test (Vitest): the Properties cover cards.
describe("Properties", () => {
  it("renders a card per property", () => {
    renderProps();
    expect(screen.getAllByTestId("property-card")).toHaveLength(2);
  });

  it("shows the seed properties", () => {
    renderProps();
    expect(screen.getByText("Wardian, Apt 5206")).toBeInTheDocument();
    expect(screen.getByText("Singapore", { exact: true })).toBeInTheDocument();
  });
});

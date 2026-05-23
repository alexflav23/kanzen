import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { People } from "../pages/People";

// UI test (Vitest): the People directory + permit-expiry warning.
describe("People", () => {
  it("lists the household team", () => {
    render(<People />);
    expect(screen.getAllByTestId("person-row")).toHaveLength(4);
  });

  it("warns about Siti's expiring work permit", () => {
    render(<People />);
    expect(screen.getByText(/Work permit · 50d/)).toBeInTheDocument();
  });
});

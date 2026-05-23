import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Finance } from "../pages/Finance";

// UI test (Vitest): tabs + the approvals queue under the Expenses tab.
describe("Finance", () => {
  it("shows the recurring schedule by default", () => {
    render(<Finance />);
    expect(screen.getByText("Recurring schedule · 6")).toBeInTheDocument();
    expect(screen.getAllByTestId("bill-row")).toHaveLength(6);
  });

  it("shows pending approvals under the Expenses tab", () => {
    render(<Finance />);
    fireEvent.click(screen.getByRole("button", { name: /Expenses/ }));
    expect(screen.getAllByTestId("pending-row")).toHaveLength(2);
  });

  it("approving removes an item from the pending queue", () => {
    render(<Finance />);
    fireEvent.click(screen.getByRole("button", { name: /Expenses/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Approve/ })[0]);
    expect(screen.getAllByTestId("pending-row")).toHaveLength(1);
  });
});

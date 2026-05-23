import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Finance } from "../pages/Finance";

// UI test (Vitest): the approvals queue and approve/reject behaviour.
describe("Finance", () => {
  it("shows the pending-approval expenses", () => {
    render(<Finance />);
    expect(screen.getAllByTestId("pending-row")).toHaveLength(2);
  });

  it("approving removes an item from the pending queue", () => {
    render(<Finance />);
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(screen.getAllByTestId("pending-row")).toHaveLength(1);
  });
});

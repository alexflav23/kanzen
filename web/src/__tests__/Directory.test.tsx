import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Directory } from "../pages/Directory";

describe("Directory", () => {
  it("renders the operational mailboxes and role/property addresses", () => {
    render(<Directory />);
    expect(screen.getByRole("heading", { name: "Directory" })).toBeInTheDocument();
    expect(screen.getByText("Operational mailboxes")).toBeInTheDocument();
    expect(screen.getByText("Role & property addresses")).toBeInTheDocument();
    const addrs = screen.getAllByTestId("dir-address").map((e) => e.textContent);
    expect(addrs).toContain("deliveries@kanzen.family");
    expect(addrs).toContain("flavian@kanzen.family");
    expect(addrs).toHaveLength(9); // 5 mailboxes + 4 role/property
  });
});

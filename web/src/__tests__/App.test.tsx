import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";

// UI test: the shell renders the brand + grouped navigation (SPEC §5).
describe("App shell", () => {
  it("shows the Kanzen brand", () => {
    render(<App />);
    expect(screen.getByText("Kanzen")).toBeInTheDocument();
  });

  it("renders the grouped navigation items", () => {
    render(<App />);
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("INVENTORY")).toBeInTheDocument();
  });
});

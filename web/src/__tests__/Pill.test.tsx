import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "../components/Pill";

// UI unit test (Vitest + Testing Library) for a design-system component.
describe("Pill", () => {
  it("renders its children", () => {
    render(<Pill tone="accent">Owned</Pill>);
    expect(screen.getByText("Owned")).toBeInTheDocument();
  });

  it("applies a StyleX class", () => {
    render(<Pill>Tag</Pill>);
    const el = screen.getByText("Tag");
    expect(el.className.length).toBeGreaterThan(0);
  });
});

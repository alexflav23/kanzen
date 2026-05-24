import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../theme/ThemeContext";

const renderApp = () => render(<ThemeProvider><App /></ThemeProvider>);

// UI test (Vitest): the shell renders the brand + grouped navigation (SPEC §5).
describe("App shell", () => {
  it("shows the Kanzen brand", () => {
    renderApp();
    expect(screen.getByText("Kanzen")).toBeInTheDocument();
  });

  it("renders the grouped navigation items", () => {
    renderApp();
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(nav.getByText("Inventory")).toBeInTheDocument();
    expect(nav.getByText("Finance")).toBeInTheDocument();
    expect(nav.getByText("INVENTORY")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../theme/ThemeContext";

describe("Theme engine", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to light, toggles to dark, and persists", () => {
    const { container } = render(<ThemeProvider><App /></ThemeProvider>);
    const root = container.querySelector("[data-theme]")!;
    expect(root.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByTestId("theme-toggle"));
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("kanzen-theme")).toBe("dark");
  });

  it("restores the saved theme on mount", () => {
    localStorage.setItem("kanzen-theme", "dark");
    const { container } = render(<ThemeProvider><App /></ThemeProvider>);
    expect(container.querySelector("[data-theme]")!.getAttribute("data-theme")).toBe("dark");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../theme/ThemeContext";
import { AuthProvider } from "../state/AuthContext";

// The theme toggle lives in the (auth-gated) shell, so seed a session each test.
const seedSession = () => {
  localStorage.setItem("kanzen.token", "dev.token");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Toby", email: "toby@kanzen.local", role: "principal" }));
};

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <ThemeProvider><App /></ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

describe("Theme engine", () => {
  beforeEach(() => {
    localStorage.clear();
    seedSession();
  });

  it("defaults to light, toggles to dark, and persists", () => {
    const { container } = renderApp();
    const root = container.querySelector("[data-theme]")!;
    expect(root.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByTestId("theme-toggle"));
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("kanzen-theme")).toBe("dark");
  });

  it("restores the saved theme on mount", () => {
    localStorage.setItem("kanzen-theme", "dark");
    const { container } = renderApp();
    expect(container.querySelector("[data-theme]")!.getAttribute("data-theme")).toBe("dark");
  });
});

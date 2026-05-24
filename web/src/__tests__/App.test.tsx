import { render, screen, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../theme/ThemeContext";
import { AuthProvider } from "../state/AuthContext";
import { queryClient } from "../state/query";

// The shell is auth-gated, so seed a session before rendering.
beforeEach(() => {
  localStorage.setItem("kanzen.token", "dev.token");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Toby", email: "toby@kanzen.local", role: "principal" }));
});

const renderApp = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider><App /></ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

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

  it("shows the signed-in persona and a sign-out", () => {
    renderApp();
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(nav.getByText("Toby")).toBeInTheDocument();
    expect(nav.getByText("Sign out")).toBeInTheDocument();
  });
});

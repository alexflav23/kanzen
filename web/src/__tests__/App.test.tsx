import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Keep the real `can`/PERSONAS/devToken; stub only the network calls.
vi.mock("../services/auth", async (orig) => {
  const actual = await orig<typeof import("../services/auth")>();
  return { ...actual, getMe: vi.fn(), impersonate: vi.fn() };
});

import { App } from "../App";
import { ThemeProvider } from "../theme/ThemeContext";
import { AuthProvider } from "../state/AuthContext";
import { queryClient } from "../state/query";
import { getMe } from "../services/auth";

const me = (permissions: { resource: string; field: string | null; level: string }[], role = "principal") => ({
  userId: "u1", email: "x@kanzen.local", role, permissions, impersonatedBy: null,
});

beforeEach(() => {
  localStorage.setItem("kanzen.token", "dev.token");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Flavian", email: "flavian@kanzen.local", role: "principal" }));
  (getMe as Mock).mockReset();
});

const renderApp = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider><App /></ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

describe("App shell", () => {
  it("shows the Kanzen brand + the signed-in persona", () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderApp();
    expect(screen.getByText("Kanzen")).toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(nav.getByText("Flavian")).toBeInTheDocument();
    expect(nav.getByText("Sign out")).toBeInTheDocument();
  });

  it("recalibrates the nav to the principal — admin sees the gated registry/finance items", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderApp();
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(await nav.findByText("Inventory")).toBeInTheDocument();
    expect(nav.getByText("Finance")).toBeInTheDocument();
    expect(nav.getByText("Wealth")).toBeInTheDocument();
    expect(nav.getByText("INVENTORY")).toBeInTheDocument();
  });

  it("recalibrates the nav for Staff — gated items (Inventory/Finance/Wealth) are hidden", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "calendar", field: null, level: "read" }], "staff"));
    renderApp();
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    // an ungated item is always present — wait for the shell to settle on it
    expect(await nav.findByText("Properties")).toBeInTheDocument();
    await waitFor(() => expect(nav.queryByText("Inventory")).not.toBeInTheDocument());
    expect(nav.queryByText("Finance")).not.toBeInTheDocument();
    expect(nav.queryByText("Wealth")).not.toBeInTheDocument();
    expect(nav.queryByText("INVENTORY")).not.toBeInTheDocument(); // empty group hidden
  });

  it("an admin sees the impersonation switcher; a Staff principal does not", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    const { unmount } = renderApp();
    expect(await screen.findByTestId("impersonate")).toBeInTheDocument();
    unmount();
    (getMe as Mock).mockResolvedValue(me([{ resource: "calendar", field: null, level: "read" }], "staff"));
    renderApp();
    await screen.findByRole("navigation", { name: "Primary" });
    await waitFor(() => expect(screen.queryByTestId("impersonate")).not.toBeInTheDocument());
  });

  it("shows the 'viewing as' banner + Stop while impersonating (and hides the switcher)", async () => {
    // an impersonation session: effective principal is Staff, impersonatedBy = the real admin
    (getMe as Mock).mockResolvedValue({ ...me([{ resource: "calendar", field: null, level: "read" }], "staff"), impersonatedBy: "admin-uuid" });
    renderApp();
    expect(await screen.findByTestId("impersonation-banner")).toBeInTheDocument();
    expect(screen.getByTestId("stop-impersonating")).toBeInTheDocument();
    expect(screen.queryByTestId("impersonate")).not.toBeInTheDocument(); // can't chain-impersonate
  });
});

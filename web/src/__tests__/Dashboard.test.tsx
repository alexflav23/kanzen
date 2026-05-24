import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/dashboard", () => ({
  getSummary: vi.fn(async () => ({ pendingApprovals: 2, properties: 2, assets: 5, expiringPermits: 1 })),
}));

// /api/me drives the dynamic greeting — recalibrates to whoever is signed in.
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(async () => ({
    userId: "u1", name: "Flavian", email: "flavian@kanzen.local", role: "principal",
    permissions: [], impersonatedBy: null,
  })),
}));

import { Dashboard } from "../pages/Dashboard";

const renderDash = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Dashboard /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Dashboard", () => {
  it("greets and shows the live at-a-glance summary", async () => {
    renderDash();
    // greeting resolves once /api/me loads (dynamic — recalibrates to the signed-in user)
    expect(await screen.findByRole("heading", { name: "Good morning, Flavian." })).toBeInTheDocument();
    expect(await screen.findByText("Assets")).toBeInTheDocument();
    // real counts from /api/dashboard
    expect(await screen.findByText("5")).toBeInTheDocument();
  });
});

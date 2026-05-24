import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/dashboard", () => ({
  getSummary: vi.fn(async () => ({ pendingApprovals: 2, properties: 2, assets: 5, expiringPermits: 1 })),
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
    expect(screen.getByRole("heading", { name: "Good morning, Toby." })).toBeInTheDocument();
    expect(await screen.findByText("Assets")).toBeInTheDocument();
    // real counts from /api/dashboard
    expect(await screen.findByText("5")).toBeInTheDocument();
  });
});

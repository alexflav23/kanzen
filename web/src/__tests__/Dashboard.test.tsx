import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/dashboard", () => ({
  getSummary: vi.fn(async () => ({ pendingApprovals: 2, properties: 7, assets: 15, expiringPermits: 1 })),
}));
vi.mock("../services/calendar", () => ({
  listEvents: vi.fn(async () => [
    { id: "e1", title: "Waitrose delivery", startOn: "2026-05-29", category: "Delivery", source: "agent", readOnly: false },
  ]),
}));
vi.mock("../services/finance", () => ({
  listExpenses: vi.fn(async () => [
    { id: "x1", payee: "Climatec Services", amountMinor: 184000, currency: "GBP", status: "pending_approval", deductible: true, vatReclaimable: true },
  ]),
}));
vi.mock("../services/inbox", () => ({
  listActions: vi.fn(async () => [
    { id: "a1", actionType: "create_event", status: "proposed", category: "Delivery", subject: "Order dispatched", locked: false },
  ]),
}));
vi.mock("../services/properties", () => ({
  listProperties: vi.fn(async () => [{ id: "p1", name: "Wardian — Apt 5206", jurisdiction: "UK", currency: "GBP", status: "active", rooms: 0, assets: 0, bills: 0, vendors: 0 }]),
}));
vi.mock("../services/people", () => ({
  listPeople: vi.fn(async () => [{ id: "pe1", userId: null, name: "Siti", role: "Housekeeper", jurisdiction: "UK", propertyId: null, permitExpiry: "2026-07-13", reviewDue: null }]),
  daysUntil: (iso: string | null) => (iso ? Math.round((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000) : null),
}));
vi.mock("../services/lists", () => ({
  listLists: vi.fn(async () => [{ id: "l1", name: "Grocery — Wardian", vendor: "Waitrose", propertyId: "p1", type: "grocery", cycle: "weekly", nextOrder: "2026-05-28", status: "active" }]),
  listItems: vi.fn(async () => [{ id: "i1", name: "Milk", qty: 1, status: "needs_approval", recurring: false, url: null, category: "Dairy", note: null, estPriceMinor: null, currency: null, addedBy: null }]),
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
    // greeting resolves once /api/me loads (dynamic — recalibrates to the signed-in user; time-of-day aware)
    expect(await screen.findByRole("heading", { name: /Good (morning|afternoon|evening), Flavian\./ })).toBeInTheDocument();
    expect(await screen.findByText("Assets")).toBeInTheDocument();
    expect(await screen.findByText("15")).toBeInTheDocument(); // real asset count from /api/dashboard
  });

  it("renders real panels: upcoming event, pending expense, triage and expiring", async () => {
    renderDash();
    expect(await screen.findByText("Waitrose delivery")).toBeInTheDocument();
    expect(await screen.findByTestId("dash-expense")).toHaveTextContent("Climatec Services");
    expect(screen.getByText("£1,840")).toBeInTheDocument();
    expect(await screen.findByTestId("dash-expiring")).toHaveTextContent("Siti — work permit");
    expect(screen.getByText("1 expense to approve")).toBeInTheDocument(); // singular, real count
  });
});

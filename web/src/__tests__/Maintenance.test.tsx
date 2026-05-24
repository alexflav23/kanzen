import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/maintenance", () => ({
  listPlans: vi.fn(async () => [
    { id: "p1", title: "Boiler service", frequency: "annually", nextDue: "2026-06-20", vendor: "Thames Plumbing", dueSoon: true },
    { id: "p2", title: "Gutter clean", frequency: "annually", nextDue: "2026-12-01", vendor: null, dueSoon: false },
  ]),
  createPlan: vi.fn(),
  completePlan: vi.fn(),
}));

import { Maintenance } from "../pages/Maintenance";

const renderM = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Maintenance /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Maintenance", () => {
  it("lists plans and flags due-soon", async () => {
    renderM();
    expect(await screen.findAllByTestId("plan-row")).toHaveLength(2);
    expect(screen.getByText("Boiler service")).toBeInTheDocument();
    expect(screen.getByText("due soon")).toBeInTheDocument();
  });
});

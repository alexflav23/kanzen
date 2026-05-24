import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/calendar", () => ({
  listEvents: async () => [
    { id: "c1", title: "Plumber visit · Wardian", startOn: "2026-05-26", category: "maintenance", source: "manual", readOnly: false },
    { id: "c2", title: "Waitrose delivery", startOn: "2026-05-29", category: "delivery", source: "manual", readOnly: false },
    { id: "t1", title: "Order pool chemicals", startOn: "2026-05-27", category: "task", source: "task", readOnly: true },
  ],
}));

import { Calendar } from "../pages/Calendar";

const renderCal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Calendar /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Calendar", () => {
  it("renders the agenda with events and marks overlays read-only", async () => {
    renderCal();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(await screen.findByText("Plumber visit · Wardian")).toBeInTheDocument();
    expect(screen.getByText("Waitrose delivery")).toBeInTheDocument();
    expect(screen.getAllByTestId("cal-event")).toHaveLength(3);
    // the task overlay is read-only
    expect(screen.getByText(/from task · read-only/)).toBeInTheDocument();
  });
});

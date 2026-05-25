import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/calendar", () => ({
  listEvents: async () => [
    { id: "c1", title: "Plumber visit · Wardian", startOn: "2026-05-26", category: "maintenance", source: "manual", readOnly: false },
    { id: "c2", title: "Waitrose delivery", startOn: "2026-05-29", category: "delivery", source: "manual", readOnly: false },
    { id: "t1", title: "Order pool chemicals", startOn: "2026-05-27", category: "task", source: "task", readOnly: true },
  ],
  createEvent: vi.fn(async () => ({ id: "new", title: "Window cleaners", startOn: "2026-06-01", category: "manual", source: "manual", readOnly: false })),
}));

import { Calendar } from "../pages/Calendar";
import { createEvent } from "../services/calendar";

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

  it("creates a new event via the modal", async () => {
    renderCal();
    await screen.findByText("Plumber visit · Wardian");
    fireEvent.click(screen.getByRole("button", { name: "New event" }));
    expect(await screen.findByTestId("new-event")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Window cleaners" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith("t", { title: "Window cleaners", on: expect.any(String), category: "manual", propertyId: null }),
    );
  });
});

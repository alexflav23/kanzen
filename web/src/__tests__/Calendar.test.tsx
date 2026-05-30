import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

// Events dated relative to "today" so they always fall inside the current month/week grid, regardless of run date.
vi.mock("../services/calendar", () => {
  const p = (n: number) => String(n).padStart(2, "0");
  const rel = (off: number) => { const x = new Date(); x.setDate(x.getDate() + off); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  return {
    listEvents: async () => [
      { id: "c1", title: "Plumber visit · Wardian", startOn: rel(0), startTime: "09:30", endTime: "11:00", category: "maintenance", source: "manual", readOnly: false },
      { id: "c2", title: "Waitrose delivery", startOn: rel(1), startTime: null, endTime: null, category: "delivery", source: "manual", readOnly: false },
      { id: "t1", title: "Order pool chemicals", startOn: rel(-1), startTime: null, endTime: null, category: "task", source: "task", readOnly: true },
    ],
    createEvent: vi.fn(async () => ({ id: "new", title: "Window cleaners", startOn: rel(0), startTime: null, endTime: null, category: "manual", source: "manual", readOnly: false })),
    updateEvent: vi.fn(async () => ({})),
    deleteEvent: vi.fn(async () => ({})),
  };
});

import { Calendar } from "../pages/Calendar";
import { createEvent, deleteEvent, updateEvent } from "../services/calendar";

const renderCal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><Calendar /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Calendar", () => {
  it("renders the month grid by default (42 cells) with events placed as chips", async () => {
    renderCal();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(await screen.findByTestId("cal-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("cal-day")).toHaveLength(42); // 6-week month grid
    expect(await screen.findByText(/Plumber visit · Wardian/)).toBeInTheDocument(); // a chip on today's cell (time-prefixed)
    expect(screen.getByTestId("cal-period")).toBeInTheDocument();
  });

  it("switches to the agenda and marks overlays read-only", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(await screen.findByText("Waitrose delivery")).toBeInTheDocument();
    expect(screen.getAllByTestId("cal-event")).toHaveLength(3);
    expect(screen.getByText(/from task · read-only/)).toBeInTheDocument();
  });

  it("week view shows a 7-column timed hour-grid and nav changes the period label", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("tab", { name: "Week" }));
    expect(await screen.findByTestId("cal-timegrid")).toBeInTheDocument();
    expect(screen.getAllByTestId("cal-daycol")).toHaveLength(7);
    const before = screen.getByTestId("cal-period").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("cal-period").textContent).not.toBe(before);
  });

  it("day view shows a single-column hour-grid with the timed event positioned", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("tab", { name: "Day" }));
    expect(await screen.findByTestId("cal-timegrid")).toBeInTheDocument();
    expect(screen.getAllByTestId("cal-daycol")).toHaveLength(1);
    const block = await screen.findByTestId("cal-block"); // today's 09:30 event
    expect(block).toHaveTextContent("09:30");
    expect(block).toHaveTextContent("Plumber visit · Wardian");
  });

  it("clicking a day opens the new-event form pre-dated", async () => {
    renderCal();
    await screen.findByTestId("cal-grid");
    fireEvent.click(screen.getAllByTestId("cal-day")[10]);
    const modal = await screen.findByTestId("new-event");
    expect((within(modal).getByLabelText("Date") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("clicking an hour slot pre-fills the start time, and the event is created with it", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("tab", { name: "Day" }));
    const col = await screen.findByTestId("cal-daycol");
    fireEvent.click(within(col).getAllByRole("button")[0]); // first hour slot (07:00)
    const modal = await screen.findByTestId("new-event");
    expect((within(modal).getByLabelText("Start time") as HTMLInputElement).value).toBe("07:00");
    fireEvent.change(within(modal).getByLabelText("Title"), { target: { value: "Window cleaners" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Add event" }));
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith("t", expect.objectContaining({ title: "Window cleaners", startTime: "07:00" })),
    );
  });

  it("creates a new event via the modal (no time → all-day)", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "New event" }));
    expect(await screen.findByTestId("new-event")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Window cleaners" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith("t", { title: "Window cleaners", on: expect.any(String), category: "manual", propertyId: null }),
    );
  });

  it("native event modal: Edit opens the form; Delete asks to confirm, then deletes", async () => {
    renderCal();
    fireEvent.click(await screen.findByText(/Plumber visit/));
    const modal = await screen.findByTestId("event-detail");
    // Edit + Delete affordances both visible
    expect(within(modal).getByTestId("event-edit")).toBeInTheDocument();
    fireEvent.click(within(modal).getByTestId("event-edit"));
    // form fields prefilled with the existing event
    expect((within(modal).getByLabelText("Title") as HTMLInputElement).value).toMatch(/Plumber/);
    expect((within(modal).getByLabelText("Start time") as HTMLInputElement).value).toBe("09:30");
    // back out + delete with confirm step
    fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(modal).getByTestId("event-delete"));
    fireEvent.click(within(modal).getByTestId("event-delete-confirm"));
    await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith("t", "c1"));
  });

  it("read-only overlay modal: no Edit/Delete; offers to open in the source surface", async () => {
    renderCal();
    fireEvent.click(await screen.findByText(/Order pool chemicals/));
    const modal = await screen.findByTestId("event-detail");
    expect(within(modal).queryByTestId("event-edit")).toBeNull();
    expect(within(modal).queryByTestId("event-delete")).toBeNull();
    expect(within(modal).getByTestId("event-open-source")).toHaveTextContent("Open in Tasks");
  });

  it("native event Save patches the calendar event", async () => {
    renderCal();
    fireEvent.click(await screen.findByText(/Plumber visit/));
    const modal = await screen.findByTestId("event-detail");
    fireEvent.click(within(modal).getByTestId("event-edit"));
    fireEvent.change(within(modal).getByLabelText("Title"), { target: { value: "Plumber visit — rescheduled" } });
    fireEvent.click(within(modal).getByTestId("event-save"));
    await waitFor(() =>
      expect(updateEvent).toHaveBeenCalledWith("t", "c1", expect.objectContaining({ title: "Plumber visit — rescheduled" })),
    );
  });
});

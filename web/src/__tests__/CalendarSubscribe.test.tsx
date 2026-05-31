import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../realtime/RealtimeProvider", () => ({ useRealtime: () => {}, usePresence: () => [] }));
vi.mock("../services/calendar", () => ({
  listEvents: vi.fn(async () => []),
  createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(),
  getCalendarFeed: vi.fn(async () => ({
    httpUrl: "http://localhost:8080/api/calendar/feed/tok.tok.ics",
    webcalUrl: "webcal://localhost:8080/api/calendar/feed/tok.tok.ics",
  })),
}));

import { Calendar } from "../pages/Calendar";
import { getCalendarFeed } from "../services/calendar";

const renderCal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><Calendar /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("F07 iCal — Calendar subscribe", () => {
  it("Subscribe opens a modal that fetches the signed feed URL and offers a webcal link", async () => {
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(await screen.findByTestId("subscribe-modal")).toBeInTheDocument();
    await waitFor(() => expect(getCalendarFeed).toHaveBeenCalledWith("t"));
    expect(screen.getByTestId("feed-url")).toHaveTextContent("/api/calendar/feed/tok.tok.ics");
    // the Apple Calendar link uses the webcal scheme so the OS opens "Add subscription"
    expect(screen.getByTestId("feed-webcal")).toHaveAttribute("href", expect.stringContaining("webcal://"));
  });

  it("Copy link writes the https feed URL to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCal();
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await screen.findByTestId("feed-url");
    fireEvent.click(screen.getByTestId("feed-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:8080/api/calendar/feed/tok.tok.ics"));
    expect(await screen.findByText("Copied ✓")).toBeInTheDocument();
  });
});

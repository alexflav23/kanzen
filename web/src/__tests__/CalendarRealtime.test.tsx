import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import { RealtimeProvider, type RtEvent } from "../realtime/RealtimeProvider";

// A fake WebSocket we drive from the test (mirrors Realtime.test.tsx).
class FakeWS {
  static last: FakeWS | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;
  constructor(url: string) { this.url = url; FakeWS.last = this; setTimeout(() => this.onopen?.(), 0); }
  send() {}
  close() {}
  emit(ev: RtEvent) { this.onmessage?.({ data: JSON.stringify(ev) }); }
}

const listEvents = vi.fn(async () => [
  { id: "c1", title: "Plumber visit", startOn: "2026-06-01", startTime: "09:30", endTime: "11:00", category: "maintenance", source: "manual", readOnly: false },
]);
vi.mock("../services/calendar", () => ({
  listEvents: (...a: unknown[]) => listEvents(...(a as [])),
  createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(),
}));

import { Calendar } from "../pages/Calendar";

const renderCal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><RealtimeProvider><Calendar /></RealtimeProvider></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

describe("F48 — Calendar live updates", () => {
  beforeEach(() => {
    (globalThis as unknown as { WebSocket: typeof FakeWS }).WebSocket = FakeWS;
    FakeWS.last = null;
    listEvents.mockClear();
    localStorage.setItem("kanzen.token", "tok.tok.tok");
  });
  afterEach(() => vi.restoreAllMocks());

  it("a maintenance event over the socket refetches the calendar without a refresh", async () => {
    renderCal();
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(1)); // initial load
    await waitFor(() => expect(FakeWS.last).not.toBeNull());

    FakeWS.last!.emit({ eventType: "maintenance.scheduled", subject: { type: "maintenance", id: "m1" }, payload: {} });
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(2)); // invalidated → refetched
  });

  it("a calendar_event push refetches; an unrelated subject does not", async () => {
    renderCal();
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(FakeWS.last).not.toBeNull());

    // an unrelated subject (a comment on a thread) must NOT churn the calendar
    FakeWS.last!.emit({ eventType: "comment.created", subject: { type: "email_thread", id: "t1" }, payload: {} });
    await new Promise((r) => setTimeout(r, 50));
    expect(listEvents).toHaveBeenCalledTimes(1);

    // a calendar_event push does refetch
    FakeWS.last!.emit({ eventType: "calendar_event.updated", subject: { type: "calendar_event", id: "c1" }, payload: {} });
    await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(2));
  });
});

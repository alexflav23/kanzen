import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const markRead = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../services/notifications", () => ({
  getNotifications: vi.fn(async () => ({
    unread: 2,
    items: [
      { id: "n1", type: "maintenance.due", title: "Boiler service due", body: "Thames Plumbing · in 7 days", subjectType: null, subjectId: null, channels: [], read: false, createdAt: new Date().toISOString() },
      { id: "n2", type: "expense.approved", title: "Expense approved", body: null, subjectType: null, subjectId: null, channels: [], read: true, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    ],
  })),
  markRead,
}));

import { NotificationsBell } from "../components/NotificationsBell";

const renderBell = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><NotificationsBell /></AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => { localStorage.setItem("kanzen.token", "t"); markRead.mockClear(); });

describe("NotificationsBell", () => {
  it("shows the unread badge and opens a popover of recent items; clicking an unread one marks it read", async () => {
    renderBell();
    // unread badge + accessible label
    expect(await screen.findByTestId("notif-badge")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();

    // open the popover
    fireEvent.click(screen.getByTestId("notif-bell"));
    expect(await screen.findByTestId("notif-popover")).toBeInTheDocument();
    expect(screen.getAllByTestId("notif-item")).toHaveLength(2);
    expect(screen.getByText("Boiler service due")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all →" })).toHaveAttribute("href", "/notifications");

    // clicking the unread item marks it read
    fireEvent.click(screen.getByText("Boiler service due"));
    await waitFor(() => expect(markRead).toHaveBeenCalledWith("n1", "t"));
  });
});

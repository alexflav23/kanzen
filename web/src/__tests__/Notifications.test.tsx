import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const h = vi.hoisted(() => ({
  items: [
    { id: "n1", type: "task.completed", title: "Task completed", body: "Marcia serviced the boiler", subjectType: "task", subjectId: null, channels: ["in_app", "push"], read: false, createdAt: new Date().toISOString() },
    { id: "n2", type: "bill.variance_flagged", title: "A bill is outside its expected range", body: "British Gas +15%", subjectType: "bill", subjectId: null, channels: ["in_app"], read: true, createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
  ],
}));

vi.mock("../services/notifications", () => ({
  getNotifications: async () => ({ unread: h.items.filter((i) => !i.read).length, items: h.items }),
  markRead: async (id: string) => { h.items = h.items.map((i) => (i.id === id ? { ...i, read: true } : i)); return { ok: true }; },
}));

import { Notifications } from "../pages/Notifications";

const renderNotifs = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Notifications /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.items = [
    { id: "n1", type: "task.completed", title: "Task completed", body: "Marcia serviced the boiler", subjectType: "task", subjectId: null, channels: ["in_app", "push"], read: false, createdAt: new Date().toISOString() },
    { id: "n2", type: "bill.variance_flagged", title: "A bill is outside its expected range", body: "British Gas +15%", subjectType: "bill", subjectId: null, channels: ["in_app"], read: true, createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
  ];
  localStorage.setItem("kanzen.token", "t");
});

describe("Notifications", () => {
  it("lists notifications with an unread count and marks one read", async () => {
    renderNotifs();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(await screen.findByText("1 unread")).toBeInTheDocument();
    expect(screen.getAllByTestId("notification-row")).toHaveLength(2);
    expect(screen.getByText("Marcia serviced the boiler")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark read" })); // the one unread item
    await waitFor(() => expect(screen.queryByText("1 unread")).not.toBeInTheDocument());
  });
});

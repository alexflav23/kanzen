import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/inbox", () => ({
  getInbox: async () => ({ counts: { agent: 3, reconciliation: 2 }, total: 5 }),
  listActions: async () => [
    { id: "a1", actionType: "create_task", status: "proposed", category: "Delivery", subject: "Amazon — order dispatched", locked: false },
    { id: "a2", actionType: "propose_asset", status: "proposed", category: "Receipt", subject: "Selfridges — your receipt", locked: true },
  ],
  confirmAction: vi.fn(),
  rejectAction: vi.fn(),
}));

import { Inbox } from "../pages/Inbox";

const renderInbox = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Inbox /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Inbox", () => {
  it("shows stream counts and the triage queue, marking financial items for Review", async () => {
    renderInbox();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findByTestId("count-agent")).toHaveTextContent("3");
    expect(screen.getByTestId("count-recon")).toHaveTextContent("2");
    expect(await screen.findByText("Amazon — order dispatched")).toBeInTheDocument();
    // the Receipt (financial) proposal is flagged Review (F27 — never auto-committed)
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getAllByTestId("triage-row")).toHaveLength(2);
  });
});

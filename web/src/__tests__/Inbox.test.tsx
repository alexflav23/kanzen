import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/collabInbox", () => ({
  listInboxes: async () => [{ id: "i1", address: "groceries@kanzen.family", label: "Groceries", kind: "shared", propertyId: null, openCount: 1 }],
  listThreads: async () => [
    { id: "t1", inboxId: "i1", subject: "Your Ocado order is on its way", snippet: "Delivery Friday · £142.50", fromName: "Ocado", lastMessageAt: new Date().toISOString(), unread: true, hasAttachments: true, status: "open", assigneeId: null, proposalCount: 1 },
  ],
  threadDetail: async () => ({
    thread: { id: "t1", inboxId: "i1", subject: "Your Ocado order is on its way", snippet: "", fromName: "Ocado", lastMessageAt: new Date().toISOString(), unread: false, hasAttachments: true, status: "open", assigneeId: null, proposalCount: 1 },
    messages: [{ id: "m1", direction: "inbound", fromAddr: "orders@ocado.com", sentAt: new Date().toISOString(), bodyText: "Your order totalling £142.50 will be delivered Friday." }],
    proposals: [{ id: "p1", actionType: "create_receipt", status: "proposed", title: "Log the Ocado receipt + expense", summary: "£142.50 grocery receipt → expense + add to the Grocery list.", confidence: 0.93 }],
    comments: [],
    attachments: [{ id: "at1", filename: "ocado-receipt.pdf", contentType: "application/pdf", sizeBytes: 84210 }],
  }),
  assignThread: vi.fn(), setThreadStatus: vi.fn(), addThreadComment: vi.fn(),
  confirmProposal: vi.fn(async () => ({ created: "expense", recordType: "expense", label: "Ocado — logged for approval" })),
  rejectProposal: vi.fn(),
}));
vi.mock("../services/people", () => ({ listPeople: async () => [{ id: "u1", name: "Marcia", role: "staff", jurisdiction: null, propertyId: null }] }));

import { Inbox } from "../pages/Inbox";

const renderInbox = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><Inbox /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Inbox (collaborative)", () => {
  it("lists inboxes + threads, and a thread shows the agent's auto-suggested proposal", async () => {
    renderInbox();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findByText("Groceries")).toBeInTheDocument(); // rail inbox
    const row = await screen.findByTestId("thread-row");
    expect(row).toHaveTextContent("Ocado");
    fireEvent.click(row);
    expect(await screen.findByTestId("thread-detail")).toBeInTheDocument();
    const proposal = await screen.findByTestId("agent-proposal");
    expect(proposal).toHaveTextContent("Log the Ocado receipt");
    expect(proposal).toHaveTextContent("93% sure"); // the intelligence + confidence
    // the forwarded receipt is attached
    expect(await screen.findByTestId("thread-attachments")).toHaveTextContent("ocado-receipt.pdf");
    // confirming the proposal calls through to create the record
    const { confirmProposal } = await import("../services/collabInbox");
    fireEvent.click(within(proposal).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(confirmProposal).toHaveBeenCalledWith("p1", "t"));
  });
});

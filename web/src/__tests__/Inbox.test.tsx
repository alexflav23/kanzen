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
  proposalDetail: vi.fn(async () => ({
    id: "p1", threadId: "t1", actionType: "create_receipt", kind: "receipt", status: "proposed",
    title: "Log the Ocado receipt + expense", summary: null, confidence: 0.93,
    willCreate: "an expense, logged for approval — Kanzen never moves money.",
    payee: "Ocado", description: null, currency: "GBP", totalMinor: 14250, category: "Groceries",
    lineItems: [{ description: "Whole milk 2L ×2", amountMinor: 380 }, { description: "Sourdough loaf", amountMinor: 320 }],
    date: "2026-05-29", time: null, location: null, links: [],
  })),
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
    // clicking the suggestion opens the review popup with the itemised receipt + total
    fireEvent.click(proposal);
    const modal = await screen.findByTestId("proposal-modal");
    // wait for the detail to load, then assert the itemised receipt + the F27 reassurance
    expect(await within(modal).findByTestId("proposal-total")).toHaveTextContent("142.50");
    expect(modal).toHaveTextContent("never moves money");
    expect(modal).toHaveTextContent("Whole milk");
    // confirming from the popup calls through to create the record
    const { confirmProposal } = await import("../services/collabInbox");
    fireEvent.click(within(modal).getByTestId("proposal-confirm"));
    await waitFor(() => expect(confirmProposal).toHaveBeenCalledWith("p1", "t"));
  });
});

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const linkedThreads = vi.fn();
vi.mock("../services/collabInbox", () => ({ linkedThreads: (...a: unknown[]) => linkedThreads(...a) }));

import { LinkedEmails } from "../components/LinkedEmails";

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><LinkedEmails targetType="asset" targetId="a1" /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => { localStorage.setItem("kanzen.token", "t"); linkedThreads.mockReset(); });

describe("LinkedEmails (back-reference loop)", () => {
  it("renders nothing when no mail is linked", async () => {
    linkedThreads.mockResolvedValue([]);
    const { container } = renderIt();
    // give the query a tick; an empty result renders null
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="linked-emails"]')).toBeNull();
  });

  it("lists the linked email thread, linking through to the inbox", async () => {
    linkedThreads.mockResolvedValue([
      { id: "th1", inboxId: "i1", subject: "Range Rover — annual service booked", snippet: "Mon 15 Jul 09:00", fromName: "Stratstone", lastMessageAt: new Date().toISOString(), unread: false, hasAttachments: true, status: "open", assigneeId: null, proposalCount: 0 },
    ]);
    renderIt();
    const row = await screen.findByTestId("linked-email-row");
    expect(row).toHaveTextContent("Range Rover — annual service booked");
    expect(row).toHaveAttribute("href", "/inbox?thread=th1");
  });
});

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const mk = (label: string, address: string, kind: string) => ({ id: address, address, label, kind, propertyId: null, openCount: 0 });
vi.mock("../services/collabInbox", () => ({
  listInboxes: async () => [
    mk("Deliveries", "deliveries@kanzen.family", "shared"), mk("Accounts", "accounts@kanzen.family", "shared"),
    mk("House", "house@kanzen.family", "shared"), mk("Vendors", "vendors@kanzen.family", "shared"),
    mk("Concierge", "concierge@kanzen.family", "shared"), mk("Wardian", "wardian@kanzen.family", "role"),
    mk("Singapore", "singapore@kanzen.family", "role"), mk("Principal", "flavian@kanzen.family", "role"),
    mk("Chief of Staff", "lorna@kanzen.family", "role"),
  ],
}));

import { Directory } from "../pages/Directory";

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><Directory /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Directory", () => {
  it("renders the household mailboxes (the same set the inbox works), grouped", async () => {
    renderIt();
    expect(screen.getByRole("heading", { name: "Directory" })).toBeInTheDocument();
    expect(await screen.findByText("Operational mailboxes")).toBeInTheDocument();
    expect(screen.getByText("Role & property addresses")).toBeInTheDocument();
    const addrs = (await screen.findAllByTestId("dir-address")).map((e) => e.textContent);
    expect(addrs).toContain("deliveries@kanzen.family");
    expect(addrs).toContain("flavian@kanzen.family");
    expect(addrs).toHaveLength(9); // 5 operational + 4 role/property
  });
});

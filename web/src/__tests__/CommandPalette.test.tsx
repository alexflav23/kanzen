import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/inbox", () => ({
  search: vi.fn(async () => ({ hits: [{ entityType: "asset", entityId: "a1", title: "Royal Oak", subtitle: "AP" }] })),
}));
const nlQuery = vi.hoisted(() => vi.fn(async () => ({ prompt: "how many watches do I have", intent: "count:asset", answer: "3 watch(s) in the registry.", count: 3, items: [] })));
vi.mock("../services/nl", () => ({ nlQuery }));
// Principal session: can("*","admin") → the Ask affordance shows.
vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ token: "t", can: () => true }) }));

import { CommandPalette } from "../components/CommandPalette";

const openPalette = () => fireEvent.keyDown(window, { key: "k", metaKey: true });
beforeEach(() => { nlQuery.mockClear(); });

describe("CommandPalette — ⌘K Ask (F32)", () => {
  it("opens on ⌘K and runs an NL question → shows the agent-grounded answer", async () => {
    render(<CommandPalette />);
    openPalette();
    const input = await screen.findByLabelText("Search");
    fireEvent.change(input, { target: { value: "how many watches do I have" } });
    // the Ask affordance appears for a Principal
    const ask = await screen.findByTestId("cmdk-ask");
    fireEvent.click(ask);
    await waitFor(() => expect(nlQuery).toHaveBeenCalledWith("how many watches do I have", "t"));
    const ans = await screen.findByTestId("nl-answer");
    expect(ans).toHaveTextContent("3 watch(s) in the registry.");
    expect(ans).toHaveTextContent("Kanzen"); // the agent ribbon
  });

  it("Enter in the search box also asks", async () => {
    render(<CommandPalette />);
    openPalette();
    const input = await screen.findByLabelText("Search");
    fireEvent.change(input, { target: { value: "what's due this week" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(nlQuery).toHaveBeenCalled());
    expect(await screen.findByTestId("nl-answer")).toBeInTheDocument();
  });
});

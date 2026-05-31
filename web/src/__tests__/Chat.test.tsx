import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Chat } from "../pages/Chat";

const listChats = vi.fn();
const createChat = vi.fn();
const listPeople = vi.fn();

vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ token: "t", userId: "me" }) }));
vi.mock("../realtime/RealtimeProvider", () => ({ useRealtime: () => {}, usePresence: () => [] }));
vi.mock("../services/chat", () => ({ listChats: () => listChats(), createChat: (m: string[]) => createChat(m) }));
vi.mock("../services/people", () => ({ listPeople: () => listPeople() }));
// CollabPanel pulls comments — stub it so the Chat page renders in isolation
vi.mock("../components/CollabPanel", () => ({ CollabPanel: ({ title }: { title: string }) => <div>panel:{title}</div> }));

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Chat /></QueryClientProvider>);
}

describe("F48 RT.4 chat page", () => {
  beforeEach(() => { listChats.mockReset(); createChat.mockReset(); listPeople.mockReset(); });

  it("lists chats with member names + last message, and opens one", async () => {
    listChats.mockResolvedValue([{ id: "c1", members: ["Lorna"], lastMessage: "Hi", lastAt: null }]);
    mount();
    await waitFor(() => expect(screen.getByText("Lorna")).toBeTruthy());
    expect(screen.getByText("Hi")).toBeTruthy();
    fireEvent.click(screen.getByTestId("chat-row"));
    await waitFor(() => expect(screen.getByText("panel:Lorna")).toBeTruthy());
  });

  it("starts a new chat from the people picker", async () => {
    listChats.mockResolvedValue([]);
    listPeople.mockResolvedValue([{ userId: "u2", name: "Marcia", colour: null }]);
    createChat.mockResolvedValue({ id: "c2", members: ["Marcia"], lastMessage: null, lastAt: null });
    mount();
    await waitFor(() => expect(screen.getByText(/No chats yet/)).toBeTruthy());
    fireEvent.click(screen.getByTestId("new-chat"));
    await waitFor(() => expect(screen.getByText("Marcia")).toBeTruthy());
    fireEvent.click(screen.getByText("Marcia"));
    await waitFor(() => expect(createChat).toHaveBeenCalledWith(["u2"]));
  });
});

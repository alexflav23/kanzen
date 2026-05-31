import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/workspace", () => ({
  getWorkspaceStatus: vi.fn(),
  connectWorkspace: vi.fn(),
}));

import { WorkspaceCard } from "../features/integrations/WorkspaceCard";
import { getWorkspaceStatus, connectWorkspace } from "../services/workspace";

const KEY = '{"type":"service_account","client_email":"k@p.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----"}';

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><WorkspaceCard /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (connectWorkspace as Mock).mockReset();
});

describe("F44 — WorkspaceCard", () => {
  it("shows 'Not connected' and a disabled Connect until a service-account key is pasted", async () => {
    (getWorkspaceStatus as Mock).mockResolvedValue({ connected: false, domain: null, validated: false, validationError: null });
    renderCard();
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Connect Workspace" });
    expect(btn).toBeDisabled(); // nothing filled in yet

    fireEvent.change(screen.getByLabelText("Workspace domain"), { target: { value: "carter.com" } });
    fireEvent.change(screen.getByLabelText("Service-account email"), { target: { value: "k@p.iam.gserviceaccount.com" } });
    fireEvent.change(screen.getByLabelText("Service-account JSON key"), { target: { value: KEY } });
    expect(btn).toBeEnabled();
  });

  it("connects with the pasted reference and then clears the key from the form", async () => {
    (getWorkspaceStatus as Mock).mockResolvedValue({ connected: false, domain: null, validated: false, validationError: null });
    (connectWorkspace as Mock).mockResolvedValue({ connected: true, domain: "carter.com", validated: true, validationError: null });
    renderCard();
    await screen.findByText("Not connected");
    fireEvent.change(screen.getByLabelText("Workspace domain"), { target: { value: "carter.com" } });
    fireEvent.change(screen.getByLabelText("Service-account email"), { target: { value: "k@p.iam.gserviceaccount.com" } });
    const json = screen.getByLabelText("Service-account JSON key") as HTMLTextAreaElement;
    fireEvent.change(json, { target: { value: KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Connect Workspace" }));
    await waitFor(() =>
      expect(connectWorkspace).toHaveBeenCalledWith(
        { domain: "carter.com", serviceAccountEmail: "k@p.iam.gserviceaccount.com", serviceAccountJson: KEY },
        "t",
      ),
    );
    // the pasted key is wiped from component state once handed off (never lingers in the DOM)
    await waitFor(() => expect(json.value).toBe(""));
  });

  it("shows a validated/connected status when already connected", async () => {
    (getWorkspaceStatus as Mock).mockResolvedValue({ connected: true, domain: "carter.com", validated: true, validationError: null });
    renderCard();
    expect(await screen.findByText("Connected · carter.com")).toBeInTheDocument();
    expect(screen.getByText("Service account validated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  });

  it("surfaces a pending validation error from the seam", async () => {
    (getWorkspaceStatus as Mock).mockResolvedValue({ connected: true, domain: "carter.com", validated: false, validationError: "hd mismatch" });
    renderCard();
    expect(await screen.findByText("Connected · carter.com")).toBeInTheDocument();
    expect(screen.getByText("hd mismatch")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

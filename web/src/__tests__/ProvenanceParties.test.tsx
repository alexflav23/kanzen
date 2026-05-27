import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/auth", async (orig) => ({ ...(await orig<typeof import("../services/auth")>()), getMe: vi.fn() }));
vi.mock("../services/assets", () => ({
  listParties: vi.fn(),
  addParty: vi.fn(),
  removeParty: vi.fn(),
  PARTY_ROLES: ["maker", "restorer", "appraiser", "prior_owner", "dealer", "insurer", "other"],
}));

import { ProvenanceParties } from "../components/ProvenanceParties";
import { getMe } from "../services/auth";
import { listParties, addParty } from "../services/assets";

const render_ = (canEdit: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><ProvenanceParties assetId="a1" canEdit={canEdit} /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getMe as Mock).mockResolvedValue({ userId: "u1", name: "Toby", email: "t@k.local", role: "principal", permissions: [{ resource: "*", field: null, level: "admin" }], impersonatedBy: null });
  (listParties as Mock).mockResolvedValue([
    { id: "p1", role: "maker", name: "Audemars Piguet", note: "Le Brassus" },
    { id: "p2", role: "prior_owner", name: "Private collection", note: null },
  ]);
  (addParty as Mock).mockReset().mockResolvedValue({ id: "p3", role: "appraiser", name: "Watchfinder", note: null });
});

describe("ProvenanceParties", () => {
  it("lists the party-roles by role", async () => {
    render_(false);
    const rows = await screen.findAllByTestId("party-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Audemars Piguet")).toBeInTheDocument();
    expect(screen.getByText("Le Brassus")).toBeInTheDocument();
  });

  it("an editor can add a party (role + name)", async () => {
    render_(true);
    await screen.findAllByTestId("party-row");
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "appraiser" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Watchfinder" } });
    fireEvent.click(screen.getByRole("button", { name: "Add party" }));
    await waitFor(() => expect(addParty).toHaveBeenCalledWith("a1", "t", { role: "appraiser", name: "Watchfinder", note: null }));
  });

  it("hides the add form + remove controls when not editable", async () => {
    render_(false);
    await screen.findAllByTestId("party-row");
    expect(screen.queryByRole("button", { name: "Add party" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });
});

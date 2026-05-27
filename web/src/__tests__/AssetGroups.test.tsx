import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const { listGroups, createGroup, groupsForAsset, addToGroup, removeFromGroup } = vi.hoisted(() => ({
  listGroups: vi.fn(async () => [
    { id: "g1", name: "Dining order", kind: "order", notes: null, memberCount: 4 },
    { id: "g2", name: "Studio rig", kind: "rig", notes: null, memberCount: 3 },
  ]),
  createGroup: vi.fn(async (_t: unknown, body: { name: string; kind: string }) => ({ id: "g-new", name: body.name, kind: body.kind, notes: null, memberCount: 0 })),
  groupsForAsset: vi.fn(async () => [{ id: "g1", name: "Dining order", kind: "order" }]),
  addToGroup: vi.fn(async () => ({ ok: true })),
  removeFromGroup: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../services/groups", () => ({ listGroups, createGroup, groupsForAsset, addToGroup, removeFromGroup, GROUP_KINDS: ["order", "set", "rig", "other"] }));
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(async () => ({ userId: "u1", name: "Flavian", email: "flavian@kanzen.local", role: "principal", permissions: [], impersonatedBy: null })),
}));

import { AssetGroups } from "../components/AssetGroups";

const renderGroups = (readOnly = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><AssetGroups assetId="a1" readOnly={readOnly} /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("kanzen.token", "t");
  localStorage.setItem("kanzen.persona", JSON.stringify({ name: "Flavian", email: "flavian@kanzen.local", role: "principal" }));
});

describe("AssetGroups", () => {
  it("renders the asset's groups as chips with kind + a remove control", async () => {
    renderGroups();
    const chip = await screen.findByTestId("group-chip");
    expect(chip).toHaveTextContent("Dining order");
    expect(chip).toHaveTextContent("order");
    expect(groupsForAsset).toHaveBeenCalledWith("t", "a1");
    expect(screen.getByRole("button", { name: "Remove from group Dining order" })).toBeInTheDocument();
    expect(screen.getByTestId("add-group")).toBeInTheDocument();
  });

  it("creates + adds a new group (name + kind)", async () => {
    renderGroups();
    await screen.findByTestId("group-chip");
    fireEvent.click(screen.getByTestId("add-group"));
    const input = screen.getByLabelText("Group name") as HTMLInputElement;
    await waitFor(() => expect(input.list?.options.length ?? 0).toBeGreaterThan(0)); // existing groups loaded
    fireEvent.change(input, { target: { value: "Tea service" } });
    fireEvent.change(screen.getByLabelText("Group kind"), { target: { value: "set" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(addToGroup).toHaveBeenCalledTimes(1));
    expect(createGroup).toHaveBeenCalledWith("t", { name: "Tea service", kind: "set", notes: null });
    expect(addToGroup).toHaveBeenCalledWith("t", "a1", "g-new");
  });

  it("reuses an existing group instead of creating a duplicate", async () => {
    renderGroups();
    await screen.findByTestId("group-chip");
    fireEvent.click(screen.getByTestId("add-group"));
    const input = screen.getByLabelText("Group name") as HTMLInputElement;
    await waitFor(() => expect(input.list?.options.length ?? 0).toBeGreaterThan(0));
    fireEvent.change(input, { target: { value: "studio rig" } }); // case-insensitive match of "Studio rig"
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(addToGroup).toHaveBeenCalledTimes(1));
    expect(createGroup).not.toHaveBeenCalled();
    expect(addToGroup).toHaveBeenCalledWith("t", "a1", "g2");
  });

  it("removes the asset from a group", async () => {
    renderGroups();
    await screen.findByTestId("group-chip");
    fireEvent.click(screen.getByRole("button", { name: "Remove from group Dining order" }));
    await waitFor(() => expect(removeFromGroup).toHaveBeenCalledWith("t", "a1", "g1"));
  });

  it("hides add + remove controls when read-only", async () => {
    renderGroups(true);
    await screen.findByTestId("group-chip");
    expect(screen.queryByTestId("add-group")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove from group/ })).not.toBeInTheDocument();
  });
});

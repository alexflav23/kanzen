import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(),
}));
vi.mock("../services/roles", () => ({
  getRoles: vi.fn(),
}));
vi.mock("../services/properties", () => ({ listProperties: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/rbac", () => ({
  listSets: vi.fn(),
  getCatalogue: vi.fn(),
  getGrants: vi.fn(),
  upsertGrant: vi.fn(),
  deleteGrant: vi.fn(),
  createSet: vi.fn(),
  deleteSet: vi.fn(),
  listTeams: vi.fn().mockResolvedValue([]),
  listUsers: vi.fn(),
  getUserRoles: vi.fn().mockResolvedValue([]),
  addUserRole: vi.fn(),
  removeUserRole: vi.fn(),
  getEffective: vi.fn(),
  getComposition: vi.fn(),
}));

import { RbacBuilder } from "../features/rbac/RbacBuilder";
import { getMe } from "../services/auth";
import { getRoles } from "../services/roles";
import { listSets, getCatalogue, getGrants, upsertGrant, listUsers, getEffective } from "../services/rbac";

const renderBuilder = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><RbacBuilder /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getMe as Mock).mockResolvedValue({ userId: "u1", name: "Flavian", email: "f@k.local", role: "principal", permissions: [{ resource: "*", field: null, level: "admin" }], impersonatedBy: null });
  (getRoles as Mock).mockResolvedValue([{ name: "principal", description: null, isSystem: true }, { name: "manager", description: null, isSystem: true }]);
  (listSets as Mock).mockResolvedValue([{ id: "s1", name: "Finance", description: null, isSystem: false, grantCount: 1 }]);
  (getCatalogue as Mock).mockResolvedValue([
    { resource: "bill", verb: "approve", minLevel: "write", sensitive: false },
    { resource: "bill", verb: "pay", minLevel: "write", sensitive: false },
  ]);
  (getGrants as Mock).mockResolvedValue([{ resource: "bill", action: "approve", field: "", scope: "all", effect: "allow" }]);
  (upsertGrant as Mock).mockReset().mockResolvedValue({ resource: "bill", action: "approve", field: "", scope: "all", effect: "deny" });
  (listUsers as Mock).mockResolvedValue([{ id: "u1", displayName: "Flavian", email: "f@k.local", role: "principal" }]);
  (getEffective as Mock).mockResolvedValue({
    userId: "u1", primaryRole: "principal", effectiveRoles: ["principal"],
    allowed: [{ key: "bill:approve", resource: "bill", verb: "approve", scope: "own", sensitive: false }],
  });
});

describe("RBAC builder", () => {
  it("renders the four builder tabs", async () => {
    renderBuilder();
    expect(await screen.findByRole("tab", { name: "Permission sets" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Teams" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "People" })).toBeInTheDocument();
  });

  it("toggling a grant to Deny calls upsertGrant with effect=deny", async () => {
    renderBuilder();
    // first set auto-selected; the bill group auto-opens because it has a grant
    const group = await screen.findByRole("group", { name: "bill:approve effect" });
    fireEvent.click(within(group).getByRole("button", { name: "Deny" }));
    await waitFor(() =>
      expect(upsertGrant).toHaveBeenCalledWith("t", "s1", { resource: "bill", action: "approve", field: "", scope: "all", effect: "deny" }),
    );
  });

  it("the People tab previews a user's effective permissions (real resolution)", async () => {
    renderBuilder();
    fireEvent.click(await screen.findByRole("tab", { name: "People" }));
    // effective preview lists the allowed action + its narrowed scope
    expect(await screen.findByText("approve")).toBeInTheDocument();
    expect(screen.getByText("own")).toBeInTheDocument();
    expect(screen.getByText("1 actions allowed")).toBeInTheDocument();
  });
});

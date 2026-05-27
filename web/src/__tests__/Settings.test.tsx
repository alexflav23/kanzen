import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/roles", async (orig) => ({
  ...(await orig<typeof import("../services/roles")>()),
  getRoles: vi.fn(),
  getPermissions: vi.fn(),
  setPermission: vi.fn(),
  deletePermission: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(),
  impersonate: vi.fn(),
}));
// The builder is the default mode; stub its data calls so mounting it doesn't hit the network.
vi.mock("../services/rbac", () => ({
  listSets: vi.fn().mockResolvedValue([]),
  getCatalogue: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
  listUsers: vi.fn().mockResolvedValue([]),
}));

import { Settings } from "../pages/Settings";
import { getRoles, getPermissions, setPermission, deletePermission, createRole, deleteRole } from "../services/roles";
import { getMe } from "../services/auth";

/** Matrix lives behind the "Advanced matrix" tab now (Builder is default). */
const toMatrix = async () => fireEvent.click(await screen.findByRole("tab", { name: "Advanced matrix" }));

const me = (perms: { resource: string; field: string | null; level: string }[]) => ({
  userId: "u1", name: "Flavian", email: "flavian@kanzen.local", role: "principal", permissions: perms, impersonatedBy: null,
});

const renderSettings = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Settings /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getRoles as Mock).mockResolvedValue([
    { name: "principal", description: "Full", isSystem: true },
    { name: "staff", description: "Scoped", isSystem: true },
    { name: "Gardener", description: "Grounds", isSystem: false },
  ]);
  (getPermissions as Mock).mockResolvedValue([
    { role: "principal", resource: "*", field: null, level: "admin" },
    { role: "staff", resource: "asset", field: null, level: "none" },
  ]);
  (setPermission as Mock).mockReset().mockResolvedValue({ role: "staff", resource: "asset", field: null, level: "read" });
  (deletePermission as Mock).mockReset().mockResolvedValue({ ok: true });
  (createRole as Mock).mockReset().mockResolvedValue({ name: "Chef", description: null, isSystem: false });
  (deleteRole as Mock).mockReset().mockResolvedValue({ ok: true });
});

describe("Settings — role management", () => {
  it("admin sees the matrix; the principal root grant is locked", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    expect(await screen.findByRole("heading", { name: "Roles & permissions" })).toBeInTheDocument();
    await toMatrix();
    // the protected root grant renders locked, not as an editable select
    expect(await screen.findByText(/admin 🔒/)).toBeInTheDocument();
    // an editable cell exists for staff · asset
    expect(screen.getByLabelText("staff · asset")).toBeInTheDocument();
  });

  it("changing a cell calls setPermission with the chosen level", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    await toMatrix();
    const cell = await screen.findByLabelText("staff · asset");
    fireEvent.change(cell, { target: { value: "read" } });
    await waitFor(() =>
      expect(setPermission).toHaveBeenCalledWith("t", { role: "staff", resource: "asset", field: null, level: "read" }),
    );
  });

  it("clearing a cell to — deletes the rule", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    await toMatrix();
    const cell = await screen.findByLabelText("staff · asset");
    fireEvent.change(cell, { target: { value: "" } });
    await waitFor(() => expect(deletePermission).toHaveBeenCalledWith("t", "staff", "asset", null));
  });

  it("a non-admin sees an administrators-only state, not the matrix", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "calendar", field: null, level: "read" }]));
    renderSettings();
    expect(await screen.findByText("Administrators only")).toBeInTheDocument();
    expect(screen.queryByText("Permission matrix")).not.toBeInTheDocument();
  });

  it("creating a role calls createRole with the name + description", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    await toMatrix();
    fireEvent.change(await screen.findByLabelText("New role"), { target: { value: "Chef" } });
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "kitchen" } });
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    await waitFor(() => expect(createRole).toHaveBeenCalledWith("t", "Chef", "kitchen"));
  });

  it("a custom role can be deleted (after confirm); system roles show no delete", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings();
    await toMatrix();
    // system roles have no delete button; the custom "Gardener" does
    expect(screen.queryByLabelText("Delete role principal")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText("Delete role Gardener"));
    await waitFor(() => expect(deleteRole).toHaveBeenCalledWith("t", "Gardener"));
  });
});

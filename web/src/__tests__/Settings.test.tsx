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
}));
vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(),
  impersonate: vi.fn(),
}));

import { Settings } from "../pages/Settings";
import { getRoles, getPermissions, setPermission, deletePermission } from "../services/roles";
import { getMe } from "../services/auth";

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
  ]);
  (getPermissions as Mock).mockResolvedValue([
    { role: "principal", resource: "*", field: null, level: "admin" },
    { role: "staff", resource: "asset", field: null, level: "none" },
  ]);
  (setPermission as Mock).mockReset().mockResolvedValue({ role: "staff", resource: "asset", field: null, level: "read" });
  (deletePermission as Mock).mockReset().mockResolvedValue({ ok: true });
});

describe("Settings — role management", () => {
  it("admin sees the matrix; the principal root grant is locked", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    expect(await screen.findByRole("heading", { name: "Roles & permissions" })).toBeInTheDocument();
    // the protected root grant renders locked, not as an editable select
    expect(await screen.findByText(/admin 🔒/)).toBeInTheDocument();
    // an editable cell exists for staff · asset
    expect(screen.getByLabelText("staff · asset")).toBeInTheDocument();
  });

  it("changing a cell calls setPermission with the chosen level", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
    const cell = await screen.findByLabelText("staff · asset");
    fireEvent.change(cell, { target: { value: "read" } });
    await waitFor(() =>
      expect(setPermission).toHaveBeenCalledWith("t", { role: "staff", resource: "asset", field: null, level: "read" }),
    );
  });

  it("clearing a cell to — deletes the rule", async () => {
    (getMe as Mock).mockResolvedValue(me([{ resource: "*", field: null, level: "admin" }]));
    renderSettings();
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
});

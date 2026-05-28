import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/properties", () => ({
  getProperty: vi.fn(async () => ({
    id: "p1", name: "Wardian — Apt 5206", jurisdiction: "GB", currency: "GBP", status: "active",
    rooms: 2, assets: 0, bills: 0, vendors: 0,
    address: "Wardian, 9 Wards Place, London E14", propType: "apartment", ownership: "owned",
    buildingManagement: "Ballymore — Wardian Estate Management",
    linked: { taskProject: "Wardian — Household", googleCalendar: "wardian.5206@group.calendar.google.com", driveFolder: "Kanzen / Properties / Wardian", onepasswordVault: "Wardian Vault" },
  })),
  patchProperty: vi.fn(), archiveProperty: vi.fn(),
}));
vi.mock("../services/locations", () => ({
  listLocations: vi.fn(async () => [
    { id: "l1", parentId: null, kind: "room", name: "Living room", floor: "52", area: "42 m²", notes: null },
    { id: "l2", parentId: "l1", kind: "cabinet", name: "Drinks cabinet", floor: null, area: null, notes: null },
  ]),
  createLocation: vi.fn(), patchLocation: vi.fn(), moveLocation: vi.fn(), deleteLocation: vi.fn(),
}));
vi.mock("../services/defects", () => ({
  listDefects: vi.fn(async () => [
    { id: "d1", propertyId: "p1", locationId: null, title: "Leaking tap", description: "drips", severity: "medium", status: "open", reportedBy: null, assignedVendorId: null, assignedVendorName: null, hasTask: false },
  ]),
  raiseDefect: vi.fn(), setDefectStatus: vi.fn(), patchDefect: vi.fn(), assignDefectVendor: vi.fn(), spawnDefectTask: vi.fn(),
}));
vi.mock("../services/vendors", () => ({ selectableVendors: vi.fn(async () => []) }));
// Assets are server-scoped via ?property=; maintenance + documents come back whole and the Bible
// filters them to this property — so the mocks return a mix to prove the client-side scoping.
vi.mock("../services/assets", () => ({
  listAssets: vi.fn(async () => [
    { id: "a1", title: "Eames Lounge Chair", maker: "Herman Miller", categoryId: null, trackingMode: "unique", quantity: 1, ownershipStatus: "owned", acquisitionCostMinor: 750000, acquisitionCurrency: "GBP", propertyId: "p1", locationId: "l1", attributes: {} },
  ]),
}));
vi.mock("../services/maintenance", () => ({
  listPlans: vi.fn(async () => [
    { id: "m1", title: "HVAC service", frequency: "annual", nextDue: "2026-09-01", vendor: "AirCo", dueSoon: false, propertyId: "p1" },
    { id: "m2", title: "Pool clean (Singapore)", frequency: "monthly", nextDue: "2026-06-01", vendor: null, dueSoon: true, propertyId: "other" },
  ]),
}));
vi.mock("../services/documents", () => ({
  listDocuments: vi.fn(async () => [
    { id: "doc1", name: "Lease agreement.pdf", category: "legal", contentType: "application/pdf", sizeBytes: 248000, sha256: null, visibility: "private", source: "upload", propertyId: "p1", immutable: true },
    { id: "doc2", name: "Unrelated.pdf", category: "legal", contentType: "application/pdf", sizeBytes: 1000, sha256: null, visibility: "private", source: "upload", propertyId: "other", immutable: false },
  ]),
}));

import { PropertyBible } from "../pages/PropertyBible";

const renderBible = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/properties/p1"]}>
          <Routes><Route path="/properties/:id" element={<PropertyBible />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("PropertyBible", () => {
  it("renders the overview from the detail aggregate", async () => {
    renderBible();
    expect(await screen.findByText("Wardian — Apt 5206")).toBeInTheDocument();
    expect(screen.getByText("Jurisdiction")).toBeInTheDocument();
  });

  it("shows full particulars and the linked-systems references (reference-only, no secret)", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    // full particulars
    expect(screen.getByText("Wardian, 9 Wards Place, London E14")).toBeInTheDocument();
    expect(screen.getByText("United Kingdom")).toBeInTheDocument(); // friendly country from jurisdiction
    expect(screen.getByText("Ballymore — Wardian Estate Management")).toBeInTheDocument();
    // linked systems — the 1Password VAULT NAME, never a secret
    expect(screen.getByText("Wardian — Household")).toBeInTheDocument(); // resolved task-project name
    expect(screen.getByText(/never credentials or secrets/i)).toBeInTheDocument();
  });

  it("shows the nested room tree under the Rooms tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Rooms" }));
    expect(await screen.findByText("Living room")).toBeInTheDocument();
    expect(screen.getByText("Drinks cabinet")).toBeInTheDocument(); // a richer 'cabinet' kind, nested under the room
  });

  it("shows per-node item counts and expands a node to its items", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Rooms" }));
    await screen.findByText("Living room");
    expect(await screen.findByText("1 item")).toBeInTheDocument(); // the Living room holds one located asset
    fireEvent.click(screen.getByRole("button", { name: "Expand Living room" }));
    expect(await screen.findByText("Eames Lounge Chair")).toBeInTheDocument(); // the per-node item list
  });

  it("lists defects under the Defects tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Defects" }));
    expect(await screen.findByText("Leaking tap")).toBeInTheDocument();
  });

  it("lists the property's assets (server-scoped) under the Assets tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Assets" }));
    expect(await screen.findByText("Eames Lounge Chair")).toBeInTheDocument();
    expect(screen.getByText("£7,500")).toBeInTheDocument(); // acquisition cost, tabular money
  });

  it("scopes maintenance plans to this property under the Maintenance tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Maintenance" }));
    expect(await screen.findByText("HVAC service")).toBeInTheDocument();
    expect(screen.queryByText("Pool clean (Singapore)")).not.toBeInTheDocument(); // other property filtered out
  });

  it("scopes documents to this property under the Documents tab", async () => {
    renderBible();
    await screen.findByText("Wardian — Apt 5206");
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(await screen.findByText("Lease agreement.pdf")).toBeInTheDocument();
    expect(screen.getByText("original")).toBeInTheDocument(); // immutable-original badge
    expect(screen.queryByText("Unrelated.pdf")).not.toBeInTheDocument();
  });
});

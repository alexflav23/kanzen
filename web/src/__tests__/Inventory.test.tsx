import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import type { AssetView } from "../services/assets";

const WATCHES = "30000000-0000-0000-0000-000000000001";
const VEHICLES = "30000000-0000-0000-0000-000000000009";

// the global brand catalogue, keyed by the selected category
const { searchBrands, recordBrand } = vi.hoisted(() => ({
  searchBrands: vi.fn(async (category: string) =>
    category.toLowerCase() === "vehicles"
      ? [{ id: "b1", name: "Mercedes-Benz", category: "vehicles", status: "verified" }, { id: "b2", name: "Porsche", category: "vehicles", status: "verified" }]
      : [{ id: "b9", name: "Rolex", category: "watches", status: "verified" }]),
  recordBrand: vi.fn(async (name: string, category: string) => ({ id: "bx", name, category, status: "community" })),
}));
vi.mock("../services/brands", () => ({ searchBrands, recordBrand }));
const v = (o: Partial<AssetView> & Pick<AssetView, "id" | "title" | "categoryId">): AssetView => ({
  maker: null, trackingMode: "unique", quantity: 1, ownershipStatus: "owned",
  acquisitionCostMinor: null, acquisitionCurrency: null, propertyId: null, attributes: {}, ...o,
});
const ALL: AssetView[] = [
  v({ id: "a1", title: "Royal Oak 15500ST", maker: "Audemars Piguet", categoryId: WATCHES, acquisitionCostMinor: 1850000, acquisitionCurrency: "GBP", heroUrl: "blob://hero-a1" }),
  v({ id: "a2", title: "1959 Les Paul Standard", maker: "Gibson", categoryId: "guitars" }),
  v({ id: "a3", title: "Crystal Tumblers", maker: "Cumbria", categoryId: "glass", trackingMode: "grouped_quantity", quantity: 6 }),
];
const TAGGED: Record<string, string[]> = { t1: ["a1"] }; // tag t1 ("Heirloom") is on a1 only

vi.mock("../services/assets", () => ({
  // honour the faceted params (options object) so the rail/search behave like the real API
  listAssets: vi.fn(async (_t: string | null, f: { category?: string | null; q?: string | null; tag?: string | null } = {}) => {
    let r = ALL;
    if (f.category) r = r.filter((a) => a.categoryId === f.category);
    if (f.tag) r = r.filter((a) => TAGGED[f.tag!]?.includes(a.id));
    if (f.q) r = r.filter((a) => `${a.title} ${a.maker ?? ""}`.toLowerCase().includes(f.q!.toLowerCase()));
    return r;
  }),
  createAsset: vi.fn(async () => ({ id: "new1" })),
  // F22 — vehicle vertical's typed template
  getTemplate: vi.fn(async () => [
    { key: "make", fieldType: "string", required: false },
    { key: "registration", fieldType: "string", required: false },
    { key: "mileage", fieldType: "number", required: false },
  ]),
}));
vi.mock("../services/tags", () => ({ listTags: vi.fn(async () => [{ id: "t1", name: "Heirloom" }]) }));
vi.mock("../services/categories", () => ({
  listCategories: vi.fn(async () => [
    { id: WATCHES, name: "Watches", parentId: null },
    { id: VEHICLES, name: "Vehicles", parentId: null },
  ]),
}));
vi.mock("../services/properties", () => ({ listProperties: vi.fn(async () => []) }));
vi.mock("../services/collections", () => ({ listCollections: vi.fn(async () => []), addMember: vi.fn() }));
vi.mock("../services/locations", () => ({ listLocations: vi.fn(async () => []) }));
vi.mock("../services/insights", () => ({
  // avg(67,100,33,50) = 62.5 → 63%
  getRegistryHealth: vi.fn(async () => ({ total: 3, photographedPct: 67, categorisedPct: 100, locatedPct: 33, proofPct: 50 })),
}));

import { Inventory } from "../pages/Inventory";
import { listAssets, createAsset } from "../services/assets";

const renderInv = (props: { vertical?: string; label?: string } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Inventory {...props} /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Inventory", () => {
  it("lists the assets from the API", async () => {
    renderInv();
    expect(await screen.findAllByTestId("asset-card")).toHaveLength(3);
  });

  it("renders bespoke vehicle cards with a reg plate + MOT/Tax/Insurance due pills", async () => {
    (listAssets as Mock).mockResolvedValueOnce([
      v({ id: "veh1", title: "Range Rover", maker: "Land Rover", categoryId: VEHICLES,
        attributes: { registration: "KA21 NZN", colour: "Black", mot_due: "2020-01-01", insurance_due: "2099-01-01" } }),
    ]);
    renderInv({ vertical: "vehicle", label: "Vehicles" });
    const card = await screen.findByTestId("vehicle-card");
    expect(within(card).getByTestId("vehicle-photo-cell")).toBeInTheDocument(); // hero photo area (placeholder until a photo is set)
    expect(within(card).getByTestId("reg-plate")).toHaveTextContent("KA21 NZN");
    expect(within(card).getByText(/overdue/)).toBeInTheDocument(); // MOT 2020 → overdue (danger pill)
  });

  it("a vertical narrows the same generic surface (Vehicles = 'vehicle' vertical)", async () => {
    renderInv({ vertical: "vehicle", label: "Vehicles" });
    expect(await screen.findByRole("heading", { name: "Vehicles" })).toBeInTheDocument();
    await screen.findAllByTestId("vehicle-card"); // vehicles render bespoke cards
    expect(listAssets).toHaveBeenCalledWith("t", expect.objectContaining({ vertical: "vehicle" }));
  });

  it("launching create from Vehicles presets the category + a vehicle-keyed brand autocomplete", async () => {
    renderInv({ vertical: "vehicle", label: "Vehicles" });
    await screen.findAllByTestId("vehicle-card");
    fireEvent.click(screen.getByRole("button", { name: "New vehicle" }));
    const modal = await screen.findByTestId("new-asset");
    // category is preset to the vertical's category (not the first/Watches)
    expect((modal.querySelector("[aria-label='Category']") as HTMLSelectElement).value).toBe(VEHICLES);
    // brand catalogue is queried for the Vehicles category, and the placeholder is the top car brand
    // (generous timeout: the maker query is debounced ~180ms and the suite runs files in parallel)
    await waitFor(() => expect(searchBrands).toHaveBeenCalledWith("Vehicles", "", "t"), { timeout: 4000 });
    const maker = screen.getByLabelText("Maker") as HTMLInputElement;
    await waitFor(() => expect(maker.placeholder).toBe("e.g. Mercedes-Benz"), { timeout: 4000 });
    // the datalist offers the catalogue suggestions
    expect(maker.list?.querySelector("option[value='Mercedes-Benz']")).toBeTruthy();
  });

  it("shows real registry completeness from the health aggregate", async () => {
    renderInv();
    expect(await screen.findByText("63%")).toBeInTheDocument(); // avg of the four checks
    expect(await screen.findByText("Data quality")).toBeInTheDocument(); // the rail nudge
  });

  it("filters by a category from the rail", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    fireEvent.click(await screen.findByRole("button", { name: "Watches" }));
    expect(await screen.findByText("Royal Oak 15500ST")).toBeInTheDocument();
    expect(screen.queryByText("1959 Les Paul Standard")).not.toBeInTheDocument();
  });

  it("searches by maker", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    fireEvent.change(screen.getByLabelText("Search inventory"), { target: { value: "Gibson" } });
    expect(await screen.findByText("1959 Les Paul Standard")).toBeInTheDocument();
    expect(screen.queryByText("Royal Oak 15500ST")).not.toBeInTheDocument();
  });

  it("filters by a tag from the rail", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    fireEvent.click(await screen.findByRole("button", { name: "Tag" })); // expand the (collapsed) Tag group
    fireEvent.click(await screen.findByRole("button", { name: "Heirloom" }));
    expect(await screen.findByText("Royal Oak 15500ST")).toBeInTheDocument();
    expect(screen.queryByText("1959 Les Paul Standard")).not.toBeInTheDocument();
    expect(listAssets).toHaveBeenCalledWith("t", expect.objectContaining({ tag: "t1" }));
  });

  it("renders the hero photo on a card that has one", async () => {
    renderInv();
    await screen.findAllByTestId("asset-card");
    const photos = await screen.findAllByTestId("asset-photo");
    expect(photos.some((img) => img.getAttribute("src") === "blob://hero-a1")).toBe(true);
  });

  it("F22 — the New asset form renders typed spec fields from the vertical's template and captures them", async () => {
    renderInv({ vertical: "vehicle", label: "Vehicles" });
    await screen.findAllByTestId("vehicle-card");
    fireEvent.click(screen.getByRole("button", { name: "New vehicle" }));
    await screen.findByTestId("new-asset");
    // typed fields from the vehicle template appear under a Specifications heading
    await screen.findByTestId("spec-fields");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Range Rover" } });
    fireEvent.change(screen.getByLabelText("Registration"), { target: { value: "KAN 1Z" } });
    fireEvent.change(screen.getByLabelText("Mileage"), { target: { value: "12000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add asset" }));
    // the number field is coerced; empty fields are dropped
    await waitFor(() =>
      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: "vehicle", attributes: { registration: "KAN 1Z", mileage: 12000 } }),
        "t",
      ),
    );
  });
});

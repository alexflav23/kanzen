import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/auth", async (orig) => ({ ...(await orig<typeof import("../services/auth")>()), getMe: vi.fn() }));
vi.mock("../services/tags", () => ({ listTags: vi.fn(), createTag: vi.fn() }));
vi.mock("../services/extensibility", () => ({
  listTaxonomies: vi.fn(), createTaxonomy: vi.fn(), listNodes: vi.fn(), addNode: vi.fn(),
  listCustomFields: vi.fn(), createCustomField: vi.fn(), deleteCustomField: vi.fn(),
  ENTITY_TYPES: ["asset", "vendor", "person"], FIELD_TYPES: ["text", "number", "money", "date", "bool", "enum", "url"],
}));

import { Customization } from "../pages/Customization";
import { getMe } from "../services/auth";
import { listTags, createTag } from "../services/tags";
import { listTaxonomies, listNodes, listCustomFields, createCustomField } from "../services/extensibility";

const render_ = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Customization /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getMe as Mock).mockResolvedValue({ userId: "u1", name: "Toby", email: "t@k.local", role: "principal", permissions: [{ resource: "*", field: null, level: "admin" }], impersonatedBy: null });
  (listTags as Mock).mockResolvedValue([{ id: "t1", name: "Heirloom" }]);
  (createTag as Mock).mockReset().mockResolvedValue({ id: "t2", name: "Insured" });
  (listTaxonomies as Mock).mockResolvedValue([{ id: "x1", name: "Regions", appliesTo: "asset", isSystem: false }]);
  (listNodes as Mock).mockResolvedValue([{ id: "n1", parentId: null, name: "Switzerland" }]);
  (listCustomFields as Mock).mockResolvedValue([{ id: "f1", entityType: "asset", key: "warranty_ref", label: "Warranty ref", type: "text", enumValues: null, sensitive: false }]);
  (createCustomField as Mock).mockReset().mockResolvedValue({ id: "f2", entityType: "asset", key: "k", label: "L", type: "text", enumValues: null, sensitive: false });
});

describe("Customization", () => {
  it("renders the three editors (tags, custom fields, taxonomies)", async () => {
    render_();
    expect(await screen.findByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Custom fields")).toBeInTheDocument();
    expect(screen.getByText("Taxonomies")).toBeInTheDocument();
    expect(await screen.findByText("Heirloom")).toBeInTheDocument(); // a seeded tag
    expect(await screen.findByTestId("field-row")).toHaveTextContent("Warranty ref"); // a custom field
  });

  it("adds a tag", async () => {
    render_();
    fireEvent.change(await screen.findByLabelText("New tag"), { target: { value: "Insured" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    await waitFor(() => expect(createTag).toHaveBeenCalledWith("Insured", "t"));
  });

  it("adds a custom field with its type", async () => {
    render_();
    await screen.findByTestId("field-row");
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "vin" } });
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "VIN" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "number" } });
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    await waitFor(() =>
      expect(createCustomField).toHaveBeenCalledWith("t", expect.objectContaining({ entityType: "asset", key: "vin", label: "VIN", type: "number" })),
    );
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/wealth", () => ({
  listEntities: vi.fn(async () => [
    { id: "e1", name: "Wardian Family Trust", kind: "trust", jurisdiction: "UK", baseCurrency: "GBP", parentEntityId: null },
    { id: "e2", name: "Subsidiary Ltd", kind: "company", jurisdiction: "JE", baseCurrency: "GBP", parentEntityId: "e1" },
  ]),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
}));
vi.mock("../services/fx", () => ({ listCurrencies: vi.fn(async () => [{ code: "GBP", symbol: "£", decimals: 2 }, { code: "SGD", symbol: "S$", decimals: 2 }]) }));

import { Entities } from "../pages/Entities";

const renderEntities = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider><Entities /></AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Entities", () => {
  it("renders the ownership tree (parent + nested child)", async () => {
    renderEntities();
    expect(await screen.findAllByTestId("entity-row")).toHaveLength(2);
    expect(screen.getByText("Wardian Family Trust")).toBeInTheDocument();
    expect(screen.getByText("Subsidiary Ltd")).toBeInTheDocument();
  });

  it("opens the New entity modal with name + parent fields", async () => {
    renderEntities();
    await screen.findAllByTestId("entity-row");
    fireEvent.click(screen.getByRole("button", { name: "New entity" }));
    const modal = await screen.findByTestId("entity-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Parent entity")).toBeInTheDocument();
    expect(screen.getByLabelText("Base currency")).toBeInTheDocument();
  });

  it("opens the Edit modal with the entity's base currency fixed (read-only)", async () => {
    renderEntities();
    await screen.findAllByTestId("entity-row");
    fireEvent.click(screen.getByRole("button", { name: "Edit Subsidiary Ltd" }));
    const modal = await screen.findByTestId("entity-modal");
    expect(modal).toHaveTextContent("Edit entity");
    expect(screen.getByLabelText("Base currency")).toBeDisabled(); // immutable on edit
  });
});

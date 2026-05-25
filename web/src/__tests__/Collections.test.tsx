import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/collections", () => ({
  listCollections: vi.fn(),
  getMembers: vi.fn(),
  createCollection: vi.fn(),
}));

import { Collections } from "../pages/Collections";
import { listCollections, getMembers, createCollection } from "../services/collections";

const renderCols = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><MemoryRouter><Collections /></MemoryRouter></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (listCollections as Mock).mockResolvedValue([{ id: "c1", name: "Watches", description: "the rotation", memberCount: 2 }]);
  (getMembers as Mock).mockResolvedValue([{ assetId: "a1", title: "Royal Oak 15500ST" }, { assetId: "a2", title: "Submariner Date" }]);
  (createCollection as Mock).mockReset().mockResolvedValue({ id: "c2", name: "Fine art", description: null, memberCount: 0 });
});

describe("Collections", () => {
  it("lists collections with member counts", async () => {
    renderCols();
    expect(await screen.findByText("Watches")).toBeInTheDocument();
    expect(screen.getByText("2 assets")).toBeInTheDocument();
  });

  it("expanding a collection shows its member assets", async () => {
    renderCols();
    fireEvent.click(await screen.findByTestId("collection-row"));
    expect(await screen.findByText("Royal Oak 15500ST")).toBeInTheDocument();
    expect(screen.getAllByTestId("collection-member")).toHaveLength(2);
  });

  it("creating a collection calls the API", async () => {
    renderCols();
    await screen.findByText("Watches");
    fireEvent.click(screen.getByRole("button", { name: "New collection" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fine art" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(createCollection).toHaveBeenCalledWith("t", "Fine art", null));
  });
});

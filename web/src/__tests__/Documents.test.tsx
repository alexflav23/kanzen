import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import type { Document } from "../services/documents";

const DOCS: Document[] = [
  { id: "d1", name: "Royal Oak receipt.pdf", category: "receipt", contentType: "application/pdf", sizeBytes: 2048, sha256: "a", visibility: "household", source: "manual", propertyId: null, immutable: true },
  { id: "d2", name: "Buildings insurance.pdf", category: "insurance", contentType: "application/pdf", sizeBytes: 9000, sha256: "b", visibility: "household", source: "agent", propertyId: null, immutable: true },
];

vi.mock("../services/documents", () => ({
  listDocuments: vi.fn(async (_t: string | null, category?: string | null) => (category ? DOCS.filter((d) => d.category === category) : DOCS)),
  uploadDocument: vi.fn(),
  fileToBase64: vi.fn(async () => ""),
}));

import { Documents } from "../pages/Documents";

const renderDocs = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Documents /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Documents", () => {
  it("lists documents from the API", async () => {
    renderDocs();
    expect(await screen.findAllByTestId("doc-row")).toHaveLength(2);
    expect(screen.getByText("Royal Oak receipt.pdf")).toBeInTheDocument();
  });

  it("filters by category", async () => {
    renderDocs();
    await screen.findAllByTestId("doc-row");
    fireEvent.click(screen.getByRole("button", { name: "insurance" }));
    expect(await screen.findByText("Buildings insurance.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Royal Oak receipt.pdf")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";
import type { Document } from "../services/documents";

const DOCS: Document[] = [
  { id: "d1", name: "Royal Oak receipt.pdf", category: "receipt", contentType: "application/pdf", sizeBytes: 2048, sha256: "a", visibility: "household", source: "manual", propertyId: null, immutable: true, createdAt: "2026-05-20T10:00:00Z" },
  { id: "d2", name: "Buildings insurance.pdf", category: "insurance", contentType: "application/pdf", sizeBytes: 9000, sha256: "b", visibility: "household", source: "agent", propertyId: null, immutable: true, createdAt: "2026-05-18T10:00:00Z" },
];

vi.mock("../services/documents", () => ({
  listDocuments: vi.fn(async (_t: string | null, category?: string | null) => (category ? DOCS.filter((d) => d.category === category) : DOCS)),
  uploadDocument: vi.fn(),
  fileToBase64: vi.fn(async () => ""),
  documentDownloadUrl: vi.fn(async () => ({ url: "blob:preview", expiresInSeconds: 300 })),
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

  it("shows KPI tiles derived from the whole store", async () => {
    renderDocs();
    await screen.findAllByTestId("doc-row");
    const kpis = screen.getAllByTestId("doc-kpi");
    expect(kpis[0]).toHaveTextContent("2"); // total documents
    expect(kpis[2]).toHaveTextContent("2"); // immutable originals
    expect(kpis[3]).toHaveTextContent("1"); // agent-filed (d2)
  });

  it("opens a PDF preview (iframe) when a row is clicked", async () => {
    renderDocs();
    const rows = await screen.findAllByTestId("doc-row");
    fireEvent.click(rows[0]);
    expect(await screen.findByTestId("doc-preview")).toBeInTheDocument();
    expect(await screen.findByTestId("pdf-frame")).toBeInTheDocument();
  });
});

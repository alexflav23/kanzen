import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const archive = {
  manifest: {
    export_version: "1.0.0",
    schema_version: "2026-05",
    object_counts: { users: 4, properties: 2, assets: 10, locations: 6, bank_transactions: 3 },
    section_checksums: { users: "aa", properties: "bb", assets: "cc", locations: "dd", bank_transactions: "ee" },
  },
  data: { users: [], properties: [], assets: [], locations: [], bank_transactions: [] },
};

vi.mock("../services/backup", () => ({
  runExport: vi.fn(async () => ({ jobId: "j1", manifest: archive.manifest, archive })),
  validateArchive: vi.fn(async () => ({ valid: true, errors: [] })),
  restoreDryRun: vi.fn(async () => ({ mode: "dry_run", applied: {}, wouldApply: { assets: 10, users: 4 } })),
}));

import { Backup } from "../pages/Backup";

const renderBackup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Backup /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => localStorage.setItem("kanzen.token", "t"));

describe("Backup", () => {
  it("runs an export → manifest counts, then validates and dry-runs a restore", async () => {
    renderBackup();
    expect(screen.getByRole("heading", { name: /Backup/ })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("run-export"));
    expect(await screen.findByTestId("manifest-counts")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument(); // assets count

    fireEvent.click(screen.getByTestId("validate"));
    expect(await screen.findByTestId("validate-result")).toBeInTheDocument();
    expect(screen.getByText("valid")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("dry-run"));
    expect(await screen.findByTestId("dryrun-result")).toBeInTheDocument();
    expect(screen.getByText("nothing written")).toBeInTheDocument();
  });
});

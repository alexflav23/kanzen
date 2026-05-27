import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(),
}));
vi.mock("../services/audit", () => ({ listAudit: vi.fn(), listAuditActions: vi.fn() }));

import { AuditLog } from "../features/audit/AuditLog";
import { getMe } from "../services/auth";
import { listAudit, listAuditActions } from "../services/audit";

const entry = (action: string, actorName: string | null = "Toby") => ({
  id: action, at: "2026-05-20T10:00:00Z", actorType: "user", actorId: "u1", actorName,
  action, targetType: "asset", targetId: "t1", detail: {},
});

const renderLog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><AuditLog /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getMe as Mock).mockResolvedValue({ userId: "u1", name: "Flavian", email: "f@k.local", role: "principal", permissions: [{ resource: "*", field: null, level: "admin" }], impersonatedBy: null });
  (listAudit as Mock).mockResolvedValue([
    entry("asset.create"), entry("asset.move"), entry("asset.delete"), entry("bill.approve"), entry("permission.set"),
  ]);
  (listAuditActions as Mock).mockResolvedValue(["asset.create", "asset.move", "asset.delete", "bill.approve", "permission.set"]);
});

describe("AuditLog", () => {
  it("renders the action log as a timeline with one row per entry", async () => {
    renderLog();
    const rows = await screen.findAllByTestId("timeline-row");
    expect(rows).toHaveLength(5);
    expect(screen.getByTestId("audit-count")).toHaveTextContent("5 entries");
  });

  it("maps audit actions to timeline tones (create=accent, delete=danger, approve=positive, move=violet, admin=muted)", async () => {
    renderLog();
    const rows = await screen.findAllByTestId("timeline-row");
    const tones = Object.fromEntries(rows.map((r) => [r.textContent?.trim().split("\n")[0], r.getAttribute("data-tone")]));
    // rows are titled by the humanised action ("asset create", etc.)
    const byTitle = (t: string) => rows.find((r) => r.textContent?.includes(t))?.getAttribute("data-tone");
    expect(byTitle("asset create")).toBe("accent");
    expect(byTitle("asset move")).toBe("violet");
    expect(byTitle("asset delete")).toBe("danger");
    expect(byTitle("bill approve")).toBe("positive");
    expect(byTitle("permission set")).toBe("muted");
    void tones;
  });

  it("offers an action filter built from the distinct actions", async () => {
    renderLog();
    await screen.findAllByTestId("timeline-row");
    const select = screen.getByLabelText("Action") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain("bill.approve");
  });
});

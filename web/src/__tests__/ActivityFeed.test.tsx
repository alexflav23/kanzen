import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/auth", async (orig) => ({
  ...(await orig<typeof import("../services/auth")>()),
  getMe: vi.fn(),
}));
vi.mock("../services/audit", () => ({ getActivity: vi.fn() }));

import { ActivityFeed } from "../features/audit/ActivityFeed";
import { getMe } from "../services/auth";
import { getActivity } from "../services/audit";

const render_ = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><ActivityFeed targetType="asset" targetId="a1" /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.setItem("kanzen.token", "t");
  (getMe as Mock).mockResolvedValue({ userId: "u1", name: "Toby", email: "t@k.local", role: "principal", permissions: [{ resource: "asset", field: null, level: "read" }], impersonatedBy: null });
});

describe("ActivityFeed", () => {
  it("renders the entity's audit trail as a timeline (with tones)", async () => {
    (getActivity as Mock).mockResolvedValue([
      { id: "1", at: "2026-05-20T10:00:00Z", actorType: "user", actorId: "u1", actorName: "Lorna", action: "asset.move", targetType: "asset", targetId: "a1", detail: {} },
      { id: "2", at: "2026-05-19T10:00:00Z", actorType: "user", actorId: "u1", actorName: "Toby", action: "asset.create", targetType: "asset", targetId: "a1", detail: {} },
    ]);
    render_();
    const rows = await screen.findAllByTestId("timeline-row");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.textContent?.includes("asset move"))?.getAttribute("data-tone")).toBe("violet");
    expect(rows.find((r) => r.textContent?.includes("asset create"))?.getAttribute("data-tone")).toBe("accent");
    expect(screen.getByText(/Lorna/)).toBeInTheDocument(); // actor as subtitle
  });

  it("shows an empty state when the entity has no activity", async () => {
    (getActivity as Mock).mockResolvedValue([]);
    render_();
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });
});

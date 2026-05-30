import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SetupBanner } from "../components/SetupBanner";

const getSetupState = vi.fn();
vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("../services/tenants", async () => {
  const actual = await vi.importActual<typeof import("../services/tenants")>("../services/tenants");
  return { ...actual, getSetupState: () => getSetupState() };
});

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><SetupBanner /></QueryClientProvider>);
}

describe("F46 Dashboard setup banner", () => {
  beforeEach(() => getSetupState.mockReset());

  it("shows the next step when onboarding is incomplete", async () => {
    getSetupState.mockResolvedValue({ currentStep: "first_property", completed: false });
    mount();
    await waitFor(() => expect(screen.getByTestId("setup-banner")).toBeTruthy());
    expect(screen.getByText(/Add your first property/)).toBeTruthy();
    expect((screen.getByTestId("resume-setup") as HTMLAnchorElement).getAttribute("href")).toBe("/onboard");
  });

  it("renders nothing when setup is complete (the seeded default tenant)", async () => {
    getSetupState.mockResolvedValue({ currentStep: null, completed: true });
    const { container } = mount();
    await waitFor(() => expect(getSetupState).toHaveBeenCalled());
    expect(screen.queryByTestId("setup-banner")).toBeNull();
    expect(container.textContent).toBe("");
  });
});

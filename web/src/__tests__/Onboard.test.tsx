import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Onboard } from "../pages/Onboard";

const getSetupState = vi.fn();
const advanceSetup = vi.fn();
const createProperty = vi.fn().mockResolvedValue({ id: "p1" });
const navigate = vi.fn();

vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("../services/tenants", async () => {
  const actual = await vi.importActual<typeof import("../services/tenants")>("../services/tenants");
  return { ...actual, getSetupState: () => getSetupState(), advanceSetup: (s: string) => advanceSetup(s) };
});
vi.mock("../services/properties", () => ({ createProperty: (...a: unknown[]) => createProperty(...a) }));

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter><Onboard /></MemoryRouter></QueryClientProvider>);
}

describe("F46 onboarding wizard", () => {
  beforeEach(() => { getSetupState.mockReset(); advanceSetup.mockReset(); createProperty.mockClear(); navigate.mockClear(); });

  it("lands on the current step and advances on the primary action", async () => {
    getSetupState.mockResolvedValue({ currentStep: "verify_email", completed: false });
    advanceSetup.mockResolvedValue({ currentStep: "workspace", completed: false });
    mount();
    await waitFor(() => expect(screen.getByText("Verify your email")).toBeTruthy());
    fireEvent.click(screen.getByTestId("step-primary"));
    await waitFor(() => expect(advanceSetup).toHaveBeenCalledWith("verify_email"));
  });

  it("the first-property step creates a property before advancing", async () => {
    getSetupState.mockResolvedValue({ currentStep: "first_property", completed: false });
    advanceSetup.mockResolvedValue({ currentStep: "initial_people", completed: false });
    mount();
    await waitFor(() => expect(screen.getByText("Add your first property")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Property name"), { target: { value: "Wardian 5206" } });
    fireEvent.click(screen.getByTestId("step-primary"));
    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    expect(createProperty.mock.calls[0][0]).toMatchObject({ name: "Wardian 5206", jurisdiction: "uk", currency: "GBP" });
    await waitFor(() => expect(advanceSetup).toHaveBeenCalledWith("first_property"));
  });

  it("finishing the last step navigates to the dashboard", async () => {
    getSetupState.mockResolvedValue({ currentStep: "tour", completed: false });
    advanceSetup.mockResolvedValue({ currentStep: null, completed: true });
    mount();
    await waitFor(() => expect(screen.getByText(/You're ready/)).toBeTruthy());
    fireEvent.click(screen.getByTestId("step-primary"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });
});

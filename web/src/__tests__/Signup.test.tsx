import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DevLogin } from "../auth/DevLogin";
import { slugify } from "../services/tenants";

const signIn = vi.fn().mockResolvedValue(undefined);
vi.mock("../state/AuthContext", () => ({ useAuth: () => ({ signIn }) }));
const createTenant = vi.fn().mockResolvedValue({
  tenantId: "t1", slug: "the-carter-household", principalUserId: "u1", currentStep: "verify_email", note: "ok",
});
vi.mock("../services/tenants", async () => {
  const actual = await vi.importActual<typeof import("../services/tenants")>("../services/tenants");
  return { ...actual, createTenant: (...a: unknown[]) => createTenant(...a) };
});

describe("F46 workspace signup", () => {
  beforeEach(() => { signIn.mockClear(); createTenant.mockClear(); });

  it("slugify turns a workspace name into a clean subdomain label", () => {
    expect(slugify("The Carter Household")).toBe("the-carter-household");
    expect(slugify("  Açai & Co!! ")).toBe("a-ai-co");
  });

  it("toggles to signup, previews the slug, and creates + signs in the new principal", async () => {
    render(<DevLogin />);
    fireEvent.click(screen.getByTestId("to-signup"));
    expect(screen.getByTestId("signup-form")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "The Carter Household" } });
    // the live slug preview appears
    expect(screen.getByText("the-carter-household")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Toby Carter" } });
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "toby@carter.family" } });

    fireEvent.click(screen.getByTestId("signup-submit"));
    await waitFor(() => expect(createTenant).toHaveBeenCalledTimes(1));
    expect(createTenant).toHaveBeenCalledWith({
      name: "The Carter Household",
      slug: "the-carter-household",
      principal: { name: "Toby Carter", email: "toby@carter.family" },
    });
    // lands the new principal straight in their fresh workspace
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ name: "Toby Carter", email: "toby@carter.family", role: "principal" }));
  });

  it("disables submit until the form is valid", () => {
    render(<DevLogin />);
    fireEvent.click(screen.getByTestId("to-signup"));
    expect((screen.getByTestId("signup-submit") as HTMLButtonElement).disabled).toBe(true);
  });
});

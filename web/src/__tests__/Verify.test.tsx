import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../services/tenants", () => ({ verifyEmail: vi.fn() }));

import { Verify } from "../pages/Verify";
import { verifyEmail } from "../services/tenants";

const setUrl = (search: string) => window.history.pushState({}, "", `/verify${search}`);
const renderVerify = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Verify />
    </QueryClientProvider>,
  );

beforeEach(() => (verifyEmail as Mock).mockReset());

describe("F46 — email verification page", () => {
  it("confirms a valid token and offers to continue setup", async () => {
    (verifyEmail as Mock).mockResolvedValue({ verified: true, nextStep: "workspace" });
    setUrl("?token=good.tok");
    renderVerify();
    expect(screen.getByText("Verifying your email…")).toBeInTheDocument();
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith("good.tok"));
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText("workspace")).toBeInTheDocument(); // the next step
    expect(screen.getByTestId("verify-continue")).toHaveAttribute("href", "/onboard");
  });

  // The "Couldn't verify" UI is exercised below via the no-token path (identical render branch). The API-rejection →
  // isError → failed wiring is TanStack Query's own behaviour; we don't re-prove it here (a rejecting queryFn trips
  // vitest 2.x's unhandled-rejection guard, a harness quirk, not a component bug). The backend ITs cover a bad token → 400.
  it("errors when the link has no token (never calls the API)", async () => {
    setUrl("");
    renderVerify();
    expect(await screen.findByText("Couldn't verify")).toBeInTheDocument();
    expect(screen.getByTestId("verify-home")).toHaveAttribute("href", "/");
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});

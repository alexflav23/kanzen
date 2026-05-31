import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AuthProvider } from "../state/AuthContext";

vi.mock("../services/cognito", () => ({ cognitoEnabled: true, signIn: vi.fn(), cognitoSignOut: vi.fn() }));

import { CognitoLogin } from "../auth/CognitoLogin";
import { signIn } from "../services/cognito";

const renderLogin = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><CognitoLogin /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  (signIn as Mock).mockReset();
});

const fillCreds = () => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "flv@kanzen.family" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Sup3rSecret!" } });
  fireEvent.click(screen.getByTestId("cognito-submit"));
};

describe("F01 — Cognito sign-in", () => {
  it("email + password → success stores the ID token as the bearer", async () => {
    (signIn as Mock).mockResolvedValue({ kind: "success", idToken: "id.tok.tok" });
    renderLogin();
    fillCreds();
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("flv@kanzen.family", "Sup3rSecret!"));
    await waitFor(() => expect(localStorage.getItem("kanzen.token")).toBe("id.tok.tok"));
  });

  it("a TOTP MFA challenge prompts for the code, then completes", async () => {
    const mfaSubmit = vi.fn().mockResolvedValue({ kind: "success", idToken: "id.after.mfa" });
    (signIn as Mock).mockResolvedValue({ kind: "mfa", submit: mfaSubmit });
    renderLogin();
    fillCreds();
    // the MFA step appears
    const code = await screen.findByLabelText("Verification code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByTestId("cognito-mfa-submit"));
    await waitFor(() => expect(mfaSubmit).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(localStorage.getItem("kanzen.token")).toBe("id.after.mfa"));
  });

  it("first-login prompts to set a new password", async () => {
    const setPw = vi.fn().mockResolvedValue({ kind: "success", idToken: "id.after.pw" });
    (signIn as Mock).mockResolvedValue({ kind: "newPassword", submit: setPw });
    renderLogin();
    fillCreds();
    const npw = await screen.findByLabelText("New password");
    fireEvent.change(npw, { target: { value: "Br4ndNewP@ss!!" } });
    fireEvent.click(screen.getByTestId("cognito-newpw-submit"));
    await waitFor(() => expect(setPw).toHaveBeenCalledWith("Br4ndNewP@ss!!"));
    await waitFor(() => expect(localStorage.getItem("kanzen.token")).toBe("id.after.pw"));
  });

  it("surfaces a sign-in error", async () => {
    (signIn as Mock).mockResolvedValue({ kind: "error", message: "Incorrect username or password." });
    renderLogin();
    fillCreds();
    expect(await screen.findByText("Incorrect username or password.")).toBeInTheDocument();
  });
});

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
  type IAuthenticationCallback,
} from "amazon-cognito-identity-js";

// F01 — real Cognito sign-in (prod). Configured from the pool Terraform provisions; the web build injects these. When
// unset (local dev), `cognitoEnabled` is false and the app falls back to the DevLogin persona switcher.
const POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;

export const cognitoEnabled = !!(POOL_ID && CLIENT_ID);

const pool = () => new CognitoUserPool({ UserPoolId: POOL_ID as string, ClientId: CLIENT_ID as string });

/** A step in the sign-in flow — resolved as a discriminated union so the UI renders the right prompt. The ID token is
 *  the bearer the app uses (its `email`/`sub`/`custom:role` claims drive the UI; the server validates it via HttpJwks). */
export type SignInStep =
  | { kind: "success"; idToken: string }
  | { kind: "mfa"; submit: (code: string) => Promise<SignInStep> } // TOTP / SMS challenge
  | { kind: "newPassword"; submit: (newPassword: string) => Promise<SignInStep> } // first-login password set
  | { kind: "error"; message: string };

// One round-trip through the Cognito SDK's callback API, surfaced as a SignInStep. Challenge callbacks re-enter `run`
// with the next action (send the MFA code / complete the new-password challenge), so the flow chains promise-to-promise.
function run(user: CognitoUser, action: (cbs: IAuthenticationCallback) => void): Promise<SignInStep> {
  return new Promise((resolve) => {
    const cbs: IAuthenticationCallback = {
      onSuccess: (session: CognitoUserSession) =>
        resolve({ kind: "success", idToken: session.getIdToken().getJwtToken() }),
      onFailure: (err: Error) => resolve({ kind: "error", message: err.message || "Sign-in failed." }),
      totpRequired: () =>
        resolve({ kind: "mfa", submit: (code) => run(user, (c) => user.sendMFACode(code, c, "SOFTWARE_TOKEN_MFA")) }),
      mfaRequired: () => resolve({ kind: "mfa", submit: (code) => run(user, (c) => user.sendMFACode(code, c)) }),
      newPasswordRequired: () =>
        resolve({
          kind: "newPassword",
          submit: (pw) => run(user, (c) => user.completeNewPasswordChallenge(pw, {}, c)),
        }),
    };
    action(cbs);
  });
}

/** Start sign-in with email + password (SRP). Returns the next step (success / MFA / new-password / error). */
export function signIn(email: string, password: string): Promise<SignInStep> {
  const user = new CognitoUser({ Username: email, Pool: pool() });
  const details = new AuthenticationDetails({ Username: email, Password: password });
  return run(user, (cbs) => user.authenticateUser(details, cbs));
}

/** Clear the cached Cognito session (the app also drops its bearer). */
export function cognitoSignOut(): void {
  if (cognitoEnabled) pool().getCurrentUser()?.signOut();
}

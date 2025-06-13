"use client";

import { AuthProvider } from "react-oidc-context";
import { PropsWithChildren } from "react";
import { WebStorageStateStore } from "oidc-client-ts";

// OIDC Config
// Use frontend route for redirect_uri, not API route
const oidcRedirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/oidc-callback`;
export const oidcConfig = {
  authority: process.env.NEXT_PUBLIC_OIDC_AUTHORITY,
  client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
  redirect_uri: oidcRedirectUri,
  onSigninCallback: () => {
    // Avoid page reload on successful sign-in
    window.history.replaceState({}, document.title, "/");
  },
  userStore: typeof window !== "undefined" ? new WebStorageStateStore({ store: window.localStorage }) : undefined,
};

export function AppAuthProvider({ children }: PropsWithChildren) {
  return <AuthProvider {...oidcConfig}>{children}</AuthProvider>;
}

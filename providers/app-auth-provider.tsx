"use client";

import { AuthProvider, AuthProviderProps } from "react-oidc-context";
import { PropsWithChildren } from "react";
import { WebStorageStateStore } from "oidc-client-ts";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const authority = process.env.NEXT_PUBLIC_OIDC_AUTHORITY || `${baseUrl}/api/oidc`;
const client_id = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "web-client";
const redirect_uri = `${baseUrl}/oidc-callback`;

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id,
  redirect_uri,
  response_type: "code",
  response_mode: "query",
  onSigninCallback: () => {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, "/");
    }
  },
  userStore:
    typeof window !== "undefined"
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined,
};

export function AppAuthProvider({ children }: PropsWithChildren) {
  return <AuthProvider {...oidcConfig}>{children}</AuthProvider>;
}

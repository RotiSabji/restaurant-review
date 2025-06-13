"use client";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function OidcCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    // You may need to retrieve code_verifier from localStorage/session if using PKCE
    const code_verifier = localStorage.getItem("oidc_code_verifier") || "";
    const client_id = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "web-client";
    const redirect_uri = window.location.origin + "/oidc-callback";
    if (code) {
      fetch("/api/oidc/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri,
          client_id,
          code_verifier,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            let err;
            try {
              err = await res.json();
            } catch {
              err = { error: "OIDC token exchange failed" };
            }
            alert("OIDC Error: " + JSON.stringify(err));
            throw new Error("OIDC token exchange failed");
          }
          return res.json();
        })
        .then((data) => {
          // Store tokens in localStorage
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("id_token", data.id_token);
          // Optionally store refresh_token, expires_in, etc.
          window.location.replace("/");
        })
        .catch(() => {
          // Optionally show error UI
          router.replace("/login?error=oidc");
        });
    }
  }, [searchParams, router]);
  return <div className="flex justify-center items-center h-96">Processing login...</div>;
}

"use client";
import React, { useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (auth.isAuthenticated) {
      router.replace("/");
      return;
    }

    if (auth.signinCallback) {
      auth
        .signinCallback()
        .then(() => {
          window.location.replace("/");
        })
        .catch(async (err) => {
          console.warn("auth.signinCallback error, attempting fallback token fetch:", err);
          if (code) {
            await manualTokenExchange(code, state);
          } else {
            router.replace("/login?error=oidc");
          }
        });
    } else if (code) {
      manualTokenExchange(code, state);
    }
  }, [searchParams, router, auth]);

  const manualTokenExchange = async (code: string, state: string | null) => {
    try {
      const client_id = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "web-client";
      const redirect_uri = window.location.origin + "/oidc-callback";

      const res = await fetch("/api/oidc/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri,
          client_id,
        }),
      });

      if (!res.ok) {
        throw new Error("Token exchange failed");
      }

      const data = await res.json();
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("id_token", data.id_token);
        localStorage.setItem("token", data.access_token);
      }
      window.location.replace("/");
    } catch (err) {
      console.error("Manual token exchange failed:", err);
      router.replace("/login?error=oidc");
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-96 space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p className="text-muted-foreground text-sm font-medium">Authenticating via OIDC...</p>
    </div>
  );
}

export default function OidcCallbackPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-96">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}

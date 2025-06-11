"use client";
import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

export default function OidcCallbackPage() {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      window.location.replace("/");
    }
  }, [auth.isLoading, auth.isAuthenticated]);
  return <div className="flex justify-center items-center h-96">Processing login...</div>;
}

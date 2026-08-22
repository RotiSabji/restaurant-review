"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "react-oidc-context";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const auth = useAuth();

  useEffect(() => {
    const success = searchParams.get("success");
    const usernameParam = searchParams.get("username");
    if (usernameParam) setUsername(usernameParam);
    if (success) setError(null);
  }, [searchParams]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace(redirect);
    }
  }, [auth.isAuthenticated, router, redirect]);

  const handleOidcRedirectLogin = async () => {
    try {
      await auth.signinRedirect();
    } catch (err) {
      console.error("OIDC login error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/oidc/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "web-client",
          redirect_uri: window.location.origin + "/oidc-callback",
        }),
      });

      const data = await res.json();

      if (res.ok && data.code) {
        const tokenRes = await fetch("/api/oidc/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: data.code,
            redirect_uri: window.location.origin + "/oidc-callback",
            client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "web-client",
          }),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (typeof window !== "undefined") {
            localStorage.setItem("access_token", tokenData.access_token);
            localStorage.setItem("id_token", tokenData.id_token);
            localStorage.setItem("token", tokenData.access_token);
          }
          window.location.href = redirect;
          return;
        } else {
          const tokenErr = await tokenRes.json();
          setError(tokenErr.error || "Token exchange failed");
        }
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Sign in</h1>

        {searchParams.get("success") && (
          <div className="text-green-600 text-sm text-center mb-4 p-2 bg-green-50 rounded">
            Registration successful! Please log in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleOidcRedirectLogin}
          >
            Sign in with OIDC Portal
          </Button>

          <div className="text-center text-sm pt-2">
            Don't have an account?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center p-2 bg-red-50 rounded">
              {error}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Suspense fallback={<div className="text-center p-8">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

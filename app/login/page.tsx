"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  // Prefill username and show success message if redirected from registration
  React.useEffect(() => {
    const success = searchParams.get("success");
    const usernameParam = searchParams.get("username");
    if (usernameParam) setUsername(usernameParam);
    if (success) setError(null);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // This is a local login for demo, not OIDC flow
      const res = await fetch("/api/oidc/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push(redirect);
      } else {
        const data = await res.json();
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold mb-4">Sign in</h1>
          {searchParams.get("success") && (
            <div className="text-green-600 text-sm text-center mb-2">
              Registration successful! Please log in.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center text-sm">
              Don't have an account?{" "}
              <a
                href="/register"
                className="text-blue-600 hover:underline"
              >
                Sign up
              </a>
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

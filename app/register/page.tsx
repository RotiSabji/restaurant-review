"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/oidc/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError("Registration failed");
    }
  };

  const oidcLoginUrl =
    "https://restaurant-review-eta.vercel.app/api/oidc/authorize" +
    "?client_id=restaurant-review-app" +
    "&redirect_uri=" + encodeURIComponent("https://restaurant-review-eta.vercel.app/oidc-callback") +
    "&response_type=code" +
    "&scope=openid" +
    "&state=040e719df6e8412aad00967bf224223b" +
    "&code_challenge=ufb_H4gyI10rK3l4PAcDgRp9qT-nUy4gSQQT7mLPets" +
    "&code_challenge_method=S256" +
    "&response_mode=query";

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardContent className="pt-6">
          {success ? (
            <>
              <div className="text-green-600 text-center mb-4">Sign up successful! Please log in below.</div>
              <div className="text-center mt-4">
                Already have an account?{' '}
                <a
                  href={oidcLoginUrl}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Login
                </a>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="text-red-600 text-center">{error}</div>}
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">Sign Up</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

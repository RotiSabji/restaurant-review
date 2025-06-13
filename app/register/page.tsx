"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "react-oidc-context";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [forRes,setForRes] = useState(null);
  
  const { signinRedirect, signoutRedirect, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    try {
      await signinRedirect();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/oidc/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setForRes(res);
        // Redirect to OIDC login with success message and prefill username
        
        setUsername("");
        setPassword("");
      } else {
        const data = await res.json();
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError("Registration failed");
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold mb-4">Register</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">Register</Button>
            {error && <div className="text-red-500 text-sm">{error}</div>}
          </form>
          <div>
            <p className="text-sm text-gray-500 mt-4">
              Already have an account?{" "}
              <button onClick={handleLogin} className="text-blue-500">Login</button>
            </p>
          </div>
          {forRes && forRes.ok && (
            <div className="text-green-600 text-sm text-center mt-4">
              Registration successful! Please login
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

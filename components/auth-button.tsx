"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "react-oidc-context";
import { useTheme } from "next-themes";

export default function AuthButton() {
  const { signinRedirect, signoutRedirect, isAuthenticated: oidcAuthenticated, user } = useAuth();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      setLocalToken(token);
    }
  }, []);

  useEffect(() => {
    let name = "";
    if (user && user.profile && (user.profile.name || user.profile.sub)) {
      name = (user.profile.name || user.profile.sub) as string;
    } else if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          name = payload.name || payload.username || payload.sub || "";
        } catch {}
      }
    }
    setUsername(name);
  }, [user, oidcAuthenticated, localToken]);

  const isAuthenticated = oidcAuthenticated || Boolean(localToken);
  const avatarLetter = username ? username[0].toUpperCase() : "U";

  const handleLogin = async () => {
    try {
      if (signinRedirect) {
        await signinRedirect();
      } else {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Login failed:", error);
      window.location.href = "/login";
    }
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("id_token");
      localStorage.removeItem("token");
      setLocalToken(null);
    }
    try {
      if (signoutRedirect) {
        await signoutRedirect();
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  if (isAuthenticated) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src="/placeholder.svg?height=36&width=36"
                alt="User avatar"
              />
              <AvatarFallback>{avatarLetter}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-3 py-2 text-xs text-gray-500 font-semibold border-b">
            {username || "Logged In User"}
          </div>
          <DropdownMenuItem asChild>
            <Link href="/restaurants/create" className="w-full cursor-pointer">
              Add Restaurant
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <Button onClick={handleLogin}>Login</Button>;
}

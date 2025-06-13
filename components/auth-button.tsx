"use client";

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
import { Moon, Sun } from "lucide-react";

export default function AuthButton() {
  const { signinRedirect, signoutRedirect, isAuthenticated, user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Try to get username from OIDC user profile, or fallback to localStorage token if needed
  let username = "";
  if (user && user.profile && user.profile.name) {
    username = user.profile.name;
  } else if (typeof window !== "undefined") {
    // Try to get from localStorage (if you store a token with username info)
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // Try to decode JWT and get username (assume JWT format)
        const payload = JSON.parse(atob(token.split(".")[1]));
        username = payload.name || payload.username || "";
      } catch {}
    }
  }
  const avatarLetter = username ? username[0].toUpperCase() : "U";

  const handleLogin = async () => {
    try {
      await signinRedirect();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signoutRedirect();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isAuthenticated) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar>
            <AvatarImage
              src="/placeholder.svg?height=32&width=32"
              alt="User avatar"
            />
            <AvatarFallback>{avatarLetter}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-3 py-2 text-xs text-gray-500 font-semibold">
            {username || "User"}
          </div>
          <DropdownMenuItem asChild>
            <Link href="/restaurants/create">Add Restaurant</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <Button onClick={handleLogin}>Login</Button>;
}

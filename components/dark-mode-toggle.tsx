"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function DarkModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent mismatches on first render
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle dark mode"
        className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        disabled
      >
        <Moon size={20} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

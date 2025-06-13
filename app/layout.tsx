import AuthButton from "@/components/auth-button";
import { AppAuthProvider } from "@/providers/app-auth-provider";
import { AppContextProvider } from "@/providers/app-context-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";
import type React from "react"; // Import React
import DarkModeToggle from "@/components/dark-mode-toggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Restaurant Review Platform",
  description: "Discover and review local restaurants",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppAuthProvider>
            <AppContextProvider>
              <header className="border-b">
                <div className="max-w-[1200px] mx-auto px-4 py-4 flex justify-between items-center">
                  <Link href="/" className="text-2xl font-bold">
                    RestaurantReviews
                  </Link>
                  <div className="flex items-center gap-2">
                    <DarkModeToggle />
                    <AuthButton />
                  </div>
                </div>
              </header>
              {children}
            </AppContextProvider>
          </AppAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ApiService } from "@/services/api/apiService";
import { useAuth } from "react-oidc-context";
import { AxiosApiService } from "@/services/api/axiosApiService";

interface AppContextType {
  apiService: ApiService | null;
  isInitialized: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [apiService, setApiService] = useState<ApiService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const auth = useAuth();
  const isLoading = auth.isLoading;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isLoading) return; // Wait for OIDC to finish loading
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) {
        throw Error("Base URL not defined!");
      }

      // Create new api service instance when auth changes
      const axiosApiService = new AxiosApiService(baseUrl, auth);
      setApiService(axiosApiService);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize services:", error);
    }
  }, [auth, isLoading]); // Add isLoading as a dependency

  if (isLoading) {
    return <div className="flex justify-center items-center h-96">Loading authentication...</div>;
  }

  return (
    <AppContext.Provider value={{ apiService, isInitialized }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
};

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/lib/context/ToastContext";
import { ToastContainer } from "@/components/ui/toast-container";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";

// Import the store module to ensure module-level theme sync runs
import "@/lib/stores/editorModeStore";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ScreenReaderAnnouncerProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </ScreenReaderAnnouncerProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

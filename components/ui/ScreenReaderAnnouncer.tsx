"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface AnnounceContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const noop = (_message: string, _priority?: "polite" | "assertive") => {};

const AnnounceContext = createContext<AnnounceContextType>({
  announce: noop,
});

export function useAnnounce() {
  return useContext(AnnounceContext);
}

export function ScreenReaderAnnouncerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (clearRef.current) clearTimeout(clearRef.current);

      if (priority === "assertive") {
        setAssertiveMessage("");
        // Force re-render by clearing first then setting
        requestAnimationFrame(() => setAssertiveMessage(message));
      } else {
        setPoliteMessage("");
        requestAnimationFrame(() => setPoliteMessage(message));
      }

      // Clear after a few seconds to prevent stale announcements
      clearRef.current = setTimeout(() => {
        setPoliteMessage("");
        setAssertiveMessage("");
      }, 5000);
    },
    [],
  );

  return (
    <AnnounceContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnounceContext.Provider>
  );
}

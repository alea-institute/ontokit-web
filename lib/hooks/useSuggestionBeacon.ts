"use client";

import { useEffect, useRef } from "react";
import { suggestionsApi } from "@/lib/api/suggestions";

interface UseSuggestionBeaconOptions {
  projectId: string;
  sessionId: string | null;
  beaconToken: string | null;
  /** Returns the current Turtle source content to flush */
  getCurrentContent: () => string | null;
  enabled?: boolean;
}

/**
 * Registers visibilitychange and beforeunload handlers to flush
 * the current draft to the suggestion branch via navigator.sendBeacon().
 *
 * This is the safety net for browser close / tab switch — ensures
 * the last edit is persisted even if the user forgets to submit.
 */
export function useSuggestionBeacon({
  projectId,
  sessionId,
  beaconToken,
  getCurrentContent,
  enabled = true,
}: UseSuggestionBeaconOptions) {
  const sessionIdRef = useRef(sessionId);
  const beaconTokenRef = useRef(beaconToken);
  const getContentRef = useRef(getCurrentContent);

  // Keep refs up to date without re-registering listeners
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { beaconTokenRef.current = beaconToken; }, [beaconToken]);
  useEffect(() => { getContentRef.current = getCurrentContent; }, [getCurrentContent]);

  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      const sid = sessionIdRef.current;
      const token = beaconTokenRef.current;
      const content = getContentRef.current?.();
      if (!sid || !token || !content) return;

      suggestionsApi.beacon(projectId, sid, content, token);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    const handleBeforeUnload = () => {
      flush();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [projectId, enabled]);
}

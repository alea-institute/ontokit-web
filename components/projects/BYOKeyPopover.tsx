"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";
import { llmApi } from "@/lib/api/llm";
import { Loader2, X } from "lucide-react";

interface BYOKeyPopoverProps {
  projectId: string;
  accessToken?: string;
  provider: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onKeySaved: () => void;
}

export function BYOKeyPopover({
  projectId,
  accessToken,
  provider,
  onClose,
  onKeySaved,
}: BYOKeyPopoverProps) {
  const [keyValue, setKeyValue] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setKey = useByoKeyStore((s) => s.setKey);
  const markValidated = useByoKeyStore((s) => s.markValidated);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent the triggering click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleUseKey = async () => {
    if (!keyValue.trim()) return;

    setIsValidating(true);
    setValidationError(null);

    // Store the key first (in case validation is slow)
    setKey(projectId, provider, keyValue.trim());

    try {
      const result = await llmApi.testConnection(
        projectId,
        accessToken ?? "",
        keyValue.trim()
      );

      if (result.success) {
        markValidated(projectId);
        onKeySaved();
      } else {
        setValidationError(
          result.error ?? "This API key was rejected. Check that it's correct and has the right permissions."
        );
      }
    } catch {
      setValidationError("Could not validate key. Check your connection and try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="relative">
      <div
        ref={popoverRef}
        className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-label="Enter your API key"
      >
        <div className="flex items-start justify-between">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Enter your API key
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Close popover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Your key stays in your browser and is billed directly to you.
        </p>
        <input
          ref={inputRef}
          type="password"
          value={keyValue}
          onChange={(e) => {
            setKeyValue(e.target.value);
            setValidationError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUseKey();
          }}
          placeholder="sk-..."
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          aria-label="API key"
        />
        {validationError && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
            {validationError}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="primary"
            size="sm"
            onClick={handleUseKey}
            disabled={isValidating || !keyValue.trim()}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Validating...
              </>
            ) : (
              "Use Key"
            )}
          </Button>
          <a
            href={`settings?tab=ai`}
            className="text-xs text-primary-600 hover:underline dark:text-primary-400"
          >
            Settings
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";

interface CreditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitCredit: (name: string | null, email: string | null) => void;
}

/**
 * Post-submission modal that lets anonymous contributors optionally
 * provide their name and email for credit attribution.
 *
 * Appears AFTER a successful suggestion submit — it does not block the
 * submission itself. Credit info is remembered in localStorage via
 * useAnonymousCreditStore for future proposals.
 *
 * Includes a hidden honeypot field (name="website") that bots will fill
 * but human users won't see. The parent should pass this value through
 * to the submit payload as website="" (already handled by useAnonymousSuggestion).
 */
export function CreditModal({ open, onClose, onSubmitCredit }: CreditModalProps) {
  const creditStore = useAnonymousCreditStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Pre-fill from cached credit on open
  useEffect(() => {
    if (open) {
      setName(creditStore.name ?? "");
      setEmail(creditStore.email ?? "");
      setHoneypot(""); // Always reset honeypot
    }
  }, [open, creditStore.name, creditStore.email]);

  const handleSave = () => {
    // If the honeypot field was filled (bot behavior), silently treat as skip
    if (honeypot) {
      onClose();
      return;
    }

    const trimmedName = name.trim() || null;
    const trimmedEmail = email.trim() || null;

    // Cache credit info for future proposals (even if both are null = skip)
    if (trimmedName || trimmedEmail) {
      creditStore.setCredit(trimmedName, trimmedEmail);
    }

    onSubmitCredit(trimmedName, trimmedEmail);
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            Want credit for your suggestions?
          </DialogTitle>
          <DialogDescription>
            Your changes have been submitted for review. Optionally share your name and email so the project maintainers can follow up.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3">
          {/* Name field */}
          <div>
            <label
              htmlFor="credit-name"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="credit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Email field */}
          <div>
            <label
              htmlFor="credit-email"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Email <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="credit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Honeypot field — invisible to humans, filled by bots */}
          <input
            name="website"
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              opacity: 0,
              pointerEvents: "none",
            }}
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your info will only be used to attribute your contribution. We won&apos;t add you to any mailing list.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Info, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { getRetiredFrom } from "@/lib/hooks/useProject";

export function RetiredDemoNotice({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!getRetiredFrom(searchParams, projectId).length) return null;

  const dismiss = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("retired_from");
    const query = params.toString();
    // Next.js syncs native history updates with useSearchParams without fetching.
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  };

  return (
    <aside
      role="status"
      aria-label="Retired demo notice"
      className="z-30 w-full shrink-0 border-y border-cyan-300/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-lg shadow-slate-950/20"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300 sm:mt-0" />
          <p>This demo has reset. You’re now viewing the current demo workspace.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss retired demo notice"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-end rounded-sm px-2 font-medium text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:min-h-0 sm:self-auto"
        >
          Dismiss <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

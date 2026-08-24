"use client";

import { useLayoutEffect } from "react";
import { useSession } from "next-auth/react";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

/** Keep tab-scoped provider keys bound to the active account independently of auth UI. */
export function ByoKeySessionGuard() {
  const { data: session, status } = useSession();
  const accountId = session?.user?.id ?? session?.user?.email ?? null;

  useLayoutEffect(() => {
    if (status !== "loading") useByoKeyStore.getState().setOwner(accountId);
  }, [accountId, status]);

  return null;
}

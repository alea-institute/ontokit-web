"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  branchesApi,
  type BranchInfo,
} from "@/lib/api/revisions";

// --- sessionStorage helpers ---

function getStoredBranch(projectId: string): string | null {
  try {
    return sessionStorage.getItem(`axigraph:branch:${projectId}`);
  } catch {
    return null;
  }
}

function setStoredBranch(projectId: string, branch: string): void {
  try {
    sessionStorage.setItem(`axigraph:branch:${projectId}`, branch);
  } catch {
    /* ignore */
  }
}

// --- Context ---

interface BranchContextValue {
  // State
  branches: BranchInfo[];
  currentBranch: string;
  defaultBranch: string;
  isLoading: boolean;
  error: string | null;
  isFeatureBranch: boolean;
  pendingChanges: boolean;

  // Actions
  loadBranches: () => Promise<void>;
  createBranch: (name: string, fromBranch?: string) => Promise<BranchInfo>;
  switchBranch: (name: string) => Promise<void>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  setPendingChanges: (pending: boolean) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

interface BranchProviderProps {
  projectId: string;
  accessToken?: string;
  initialBranch?: string;
  children: ReactNode;
}

export function BranchProvider({
  projectId,
  accessToken,
  initialBranch,
  children,
}: BranchProviderProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  // Priority: URL param (initialBranch) > sessionStorage > "main" placeholder
  const [currentBranch, setCurrentBranch] = useState<string>(
    () => initialBranch || getStoredBranch(projectId) || "main"
  );
  const [defaultBranch, setDefaultBranch] = useState<string>("main");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(false);

  const isFeatureBranch = currentBranch !== defaultBranch;

  const loadBranches = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await branchesApi.list(projectId, accessToken);
      setBranches(response.items);
      setDefaultBranch(response.default_branch);
      // On first load, use DB preference if no URL param or sessionStorage set the branch
      setCurrentBranch((prev) => {
        if (prev !== "main") return prev; // already set by URL or sessionStorage
        return response.preferred_branch || response.current_branch;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load branches";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken]);

  const createBranch = useCallback(
    async (name: string, fromBranch?: string): Promise<BranchInfo> => {
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      const newBranch = await branchesApi.create(
        projectId,
        { name, from_branch: fromBranch },
        accessToken
      );

      // Refresh branches list
      await loadBranches();

      return newBranch;
    },
    [projectId, accessToken, loadBranches]
  );

  const switchBranch = useCallback(
    async (name: string) => {
      if (pendingChanges) {
        throw new Error(
          "You have pending changes. Please commit or discard them before switching branches."
        );
      }

      // Validate branch exists locally — no backend call needed
      const branchExists = branches.some((b) => b.name === name);
      if (!branchExists) {
        throw new Error(`Branch not found: ${name}`);
      }

      setCurrentBranch(name);
      setStoredBranch(projectId, name);

      // Fire-and-forget: persist to DB for cross-session restore
      if (accessToken) {
        branchesApi.savePreference(projectId, name, accessToken).catch(() => {});
      }
    },
    [branches, pendingChanges, projectId, accessToken]
  );

  const deleteBranch = useCallback(
    async (name: string, force = false) => {
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      if (name === currentBranch) {
        throw new Error("Cannot delete the current branch");
      }

      if (name === defaultBranch) {
        throw new Error("Cannot delete the default branch");
      }

      await branchesApi.delete(projectId, name, accessToken, force);

      // Refresh branches list
      await loadBranches();
    },
    [projectId, accessToken, currentBranch, defaultBranch, loadBranches]
  );

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Set initial branch if specified and different from current (client-side only)
  const [initialBranchHandled, setInitialBranchHandled] = useState(false);
  useEffect(() => {
    if (
      initialBranch &&
      !initialBranchHandled &&
      !isLoading &&
      branches.length > 0
    ) {
      const branchExists = branches.some((b) => b.name === initialBranch);
      if (branchExists && initialBranch !== currentBranch) {
        setCurrentBranch(initialBranch);
      }
      setInitialBranchHandled(true);
    }
  }, [initialBranch, initialBranchHandled, isLoading, branches, currentBranch]);

  const value: BranchContextValue = {
    branches,
    currentBranch,
    defaultBranch,
    isLoading,
    error,
    isFeatureBranch,
    pendingChanges,
    loadBranches,
    createBranch,
    switchBranch,
    deleteBranch,
    setPendingChanges,
  };

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranch(): BranchContextValue {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}

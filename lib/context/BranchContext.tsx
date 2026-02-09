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
  type BranchListResponse,
} from "@/lib/api/revisions";

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
  children: ReactNode;
}

export function BranchProvider({
  projectId,
  accessToken,
  children,
}: BranchProviderProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("main");
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
      setCurrentBranch(response.current_branch);
      setDefaultBranch(response.default_branch);
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
      if (!accessToken) {
        throw new Error("Authentication required");
      }

      if (pendingChanges) {
        throw new Error(
          "You have pending changes. Please commit or discard them before switching branches."
        );
      }

      await branchesApi.switch(projectId, name, accessToken);
      setCurrentBranch(name);

      // Refresh branches to update ahead/behind counts
      await loadBranches();
    },
    [projectId, accessToken, pendingChanges, loadBranches]
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

/**
 * Shared context mocks for BranchContext and ToastContext.
 *
 * Usage in test files:
 *   vi.mock("@/lib/context/BranchContext", () => branchContextMock());
 *   vi.mock("@/lib/context/ToastContext", () => toastContextMock());
 */
import { vi } from "vitest";

export function branchContextMock(overrides?: {
  currentBranch?: string;
  branches?: Array<{ name: string; is_default: boolean }>;
  isLoading?: boolean;
  error?: string | null;
  isFeatureBranch?: boolean;
  pendingChanges?: boolean;
  hasGitHubRemote?: boolean;
  lastSyncAt?: string | null;
  syncStatus?: string | null;
}) {
  const switchBranch = vi.fn().mockResolvedValue(undefined);
  const refreshBranches = vi.fn().mockResolvedValue(undefined);
  const createBranch = vi.fn().mockResolvedValue({ name: "new-branch", is_default: false });
  const deleteBranch = vi.fn().mockResolvedValue(undefined);
  const setPendingChanges = vi.fn();

  return {
    useBranch: () => ({
      currentBranch: overrides?.currentBranch ?? "main",
      branches: overrides?.branches ?? [{ name: "main", is_default: true }],
      defaultBranch: "main",
      isLoading: overrides?.isLoading ?? false,
      error: overrides?.error ?? null,
      isFeatureBranch: overrides?.isFeatureBranch ?? false,
      pendingChanges: overrides?.pendingChanges ?? false,
      hasGitHubRemote: overrides?.hasGitHubRemote ?? false,
      lastSyncAt: overrides?.lastSyncAt ?? null,
      syncStatus: overrides?.syncStatus ?? null,
      switchBranch,
      refreshBranches,
      createBranch,
      deleteBranch,
      setPendingChanges,
    }),
    BranchProvider: ({ children }: { children: React.ReactNode }) => children,
    __switchBranch: switchBranch,
    __refreshBranches: refreshBranches,
    __createBranch: createBranch,
    __deleteBranch: deleteBranch,
    __setPendingChanges: setPendingChanges,
  };
}

export function toastContextMock() {
  const success = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  const dismiss = vi.fn();

  return {
    useToast: () => ({ success, error, info, dismiss }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
    __success: success,
    __error: error,
    __info: info,
    __dismiss: dismiss,
  };
}

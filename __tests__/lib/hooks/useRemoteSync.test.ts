import React, { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRemoteSync } from "@/lib/hooks/useRemoteSync";
import type { RemoteSyncConfig, SyncEvent } from "@/lib/api/remoteSync";

// Mock the remoteSyncApi module
vi.mock("@/lib/api/remoteSync", () => ({
  remoteSyncApi: {
    getConfig: vi.fn(),
    getHistory: vi.fn(),
    triggerCheck: vi.fn(),
    getJobStatus: vi.fn(),
    saveConfig: vi.fn(),
    deleteConfig: vi.fn(),
  },
}));

import { remoteSyncApi } from "@/lib/api/remoteSync";

const mockedGetConfig = remoteSyncApi.getConfig as ReturnType<typeof vi.fn>;
const mockedGetHistory = remoteSyncApi.getHistory as ReturnType<typeof vi.fn>;
const mockedTriggerCheck = remoteSyncApi.triggerCheck as ReturnType<typeof vi.fn>;
const mockedGetJobStatus = remoteSyncApi.getJobStatus as ReturnType<typeof vi.fn>;
const mockedSaveConfig = remoteSyncApi.saveConfig as ReturnType<typeof vi.fn>;
const mockedDeleteConfig = remoteSyncApi.deleteConfig as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function makeConfig(overrides: Partial<RemoteSyncConfig> = {}): RemoteSyncConfig {
  return {
    id: "config-1",
    project_id: "proj-1",
    repo_owner: "owner",
    repo_name: "repo",
    branch: "main",
    file_path: "ontology.ttl",
    frequency: "24h",
    enabled: true,
    update_mode: "review_required",
    status: "idle",
    last_check_at: null,
    last_update_at: null,
    next_check_at: null,
    remote_commit_sha: null,
    pending_pr_id: null,
    error_message: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRemoteSync", () => {
  it("does not fetch when enabled is false", async () => {
    mockedGetConfig.mockResolvedValue(null);

    renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token", enabled: false }),
      { wrapper: createWrapper() },
    );

    // Give time for any potential async calls
    await act(async () => {});

    expect(mockedGetConfig).not.toHaveBeenCalled();
  });

  it("does not fetch when projectId is empty", async () => {
    mockedGetConfig.mockResolvedValue(null);

    renderHook(() =>
      useRemoteSync({ projectId: "", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await act(async () => {});

    expect(mockedGetConfig).not.toHaveBeenCalled();
  });

  it("fetches config and history on mount", async () => {
    const config = makeConfig();
    const events: SyncEvent[] = [
      {
        id: "evt-1",
        project_id: "proj-1",
        config_id: "config-1",
        event_type: "check_no_changes",
        remote_commit_sha: null,
        pr_id: null,
        changes_summary: null,
        error_message: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockedGetConfig.mockResolvedValue(config);
    mockedGetHistory.mockResolvedValue({ items: events, total: 1 });

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config).toEqual(config);
    expect(result.current.history).toEqual(events);
    expect(result.current.error).toBeNull();
  });

  it("sets error on config fetch failure", async () => {
    mockedGetConfig.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.config).toBeNull();
  });

  it("triggerCheck does nothing without accessToken", async () => {
    mockedGetConfig.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.triggerCheck();
    });

    expect(mockedTriggerCheck).not.toHaveBeenCalled();
  });

  it("triggerCheck sets isChecking and calls API", async () => {
    mockedGetConfig.mockResolvedValue(makeConfig());
    mockedGetHistory.mockResolvedValue({ items: [], total: 0 });
    mockedTriggerCheck.mockResolvedValue({ job_id: "job-1", message: "ok", status: "pending" });
    // The polling will call getJobStatus - mock it to complete immediately
    mockedGetJobStatus.mockResolvedValue({
      job_id: "job-1",
      status: "complete",
      result: {},
      error: null,
    });

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Trigger check
    await act(async () => {
      await result.current.triggerCheck();
    });

    expect(mockedTriggerCheck).toHaveBeenCalledWith("proj-1", "token");

    // Wait for polling to complete (setInterval runs with real timers)
    await waitFor(() => expect(result.current.isChecking).toBe(false), { timeout: 5000 });
  });

  it("triggerCheck handles error", async () => {
    mockedGetConfig.mockResolvedValue(null);
    mockedGetHistory.mockResolvedValue({ items: [], total: 0 });
    mockedTriggerCheck.mockRejectedValue(new Error("Check failed"));

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.triggerCheck();
    });

    expect(result.current.isChecking).toBe(false);
    expect(result.current.error).toBe("Check failed");
  });

  it("saveConfig updates config state", async () => {
    const config = makeConfig();
    mockedGetConfig.mockResolvedValue(null);
    mockedSaveConfig.mockResolvedValue(config);

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveConfig({
        repo_owner: "owner",
        repo_name: "repo",
        file_path: "ontology.ttl",
      });
    });

    expect(result.current.config).toEqual(config);
    expect(result.current.error).toBeNull();
  });

  it("deleteConfig clears config and history", async () => {
    mockedGetConfig.mockResolvedValue(makeConfig());
    mockedGetHistory.mockResolvedValue({ items: [], total: 0 });
    mockedDeleteConfig.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRemoteSync({ projectId: "proj-1", accessToken: "token" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.config).not.toBeNull();

    await act(async () => {
      await result.current.deleteConfig();
    });

    expect(result.current.config).toBeNull();
    expect(result.current.history).toEqual([]);
  });
});

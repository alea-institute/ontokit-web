import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock the remote sync API
const mockGetConfig = vi.fn();
vi.mock("@/lib/api/remoteSync", () => ({
  remoteSyncApi: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}));

import { RemoteSyncIndicator } from "@/components/editor/RemoteSyncIndicator";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("RemoteSyncIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing and skips fetch when accessToken is missing", () => {
    const { container } = render(
      <RemoteSyncIndicator projectId="proj-1" />,
      { wrapper: createWrapper() },
    );
    expect(container.innerHTML).toBe("");
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it("renders nothing when config is disabled", async () => {
    mockGetConfig.mockResolvedValue({ enabled: false, status: "idle" });
    const { container } = render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders synced button for up_to_date status", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "up_to_date" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByLabelText("In sync with remote")).toBeDefined();
    });
  });

  it("renders synced button for idle status", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "idle" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByLabelText("In sync with remote")).toBeDefined();
    });
  });

  it("links to settings for synced state", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "up_to_date" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      const link = screen.getByLabelText("In sync with remote").closest("a");
      expect(link?.getAttribute("href")).toBe("/projects/proj-1/settings#remote-sync");
    });
  });

  it("renders checking state as disabled button", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "checking" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Checking for updates from remote")).toBeDefined();
    });
  });

  it("renders update_available with link to PR when pending_pr_id exists", async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      status: "update_available",
      pending_pr_id: "pr-42",
    });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      const link = screen.getByLabelText("Update available from remote").closest("a");
      expect(link?.getAttribute("href")).toBe("/projects/proj-1/pull-requests/pr-42");
    });
  });

  it("renders update_available with link to settings when no pending PR", async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      status: "update_available",
      pending_pr_id: null,
    });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      const link = screen.getByLabelText("Update available from remote").closest("a");
      expect(link?.getAttribute("href")).toBe("/projects/proj-1/settings#remote-sync");
    });
  });

  it("renders error state", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "error" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Sync from remote error")).toBeDefined();
    });
  });

  it("renders nothing when API returns error", async () => {
    mockGetConfig.mockRejectedValue(new Error("Not found"));
    const { container } = render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("passes accessToken to API call", async () => {
    mockGetConfig.mockResolvedValue({ enabled: false, status: "idle" });
    render(
      <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalledWith("proj-1", "tok-123");
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

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

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    statusText: string;
    constructor(status: number, statusText: string, message: string) {
      super(message);
      this.status = status;
      this.statusText = statusText;
    }
  },
}));

import { RemoteSyncIndicator } from "@/components/editor/RemoteSyncIndicator";

describe("RemoteSyncIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when config is not loaded yet", () => {
    mockGetConfig.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(
      <RemoteSyncIndicator projectId="proj-1" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when config is disabled", async () => {
    mockGetConfig.mockResolvedValue({ enabled: false, status: "idle" });
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <RemoteSyncIndicator projectId="proj-1" />
      );
      container = result.container;
    });
    expect(container!.innerHTML).toBe("");
  });

  it("renders synced button for up_to_date status", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "up_to_date" });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    expect(screen.getByLabelText("In sync with remote")).toBeDefined();
  });

  it("renders synced button for idle status", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "idle" });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    expect(screen.getByLabelText("In sync with remote")).toBeDefined();
  });

  it("links to settings for synced state", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "up_to_date" });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    const link = screen.getByLabelText("In sync with remote").closest("a");
    expect(link?.getAttribute("href")).toBe("/projects/proj-1/settings#remote-sync");
  });

  it("renders checking state as disabled button", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "checking" });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    expect(screen.getByLabelText("Checking for updates from remote")).toBeDefined();
  });

  it("renders update_available with link to PR when pending_pr_id exists", async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      status: "update_available",
      pending_pr_id: "pr-42",
    });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    const link = screen.getByLabelText("Update available from remote").closest("a");
    expect(link?.getAttribute("href")).toBe("/projects/proj-1/pull-requests/pr-42");
  });

  it("renders update_available with link to settings when no pending PR", async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      status: "update_available",
      pending_pr_id: null,
    });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    const link = screen.getByLabelText("Update available from remote").closest("a");
    expect(link?.getAttribute("href")).toBe("/projects/proj-1/settings#remote-sync");
  });

  it("renders error state", async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, status: "error" });
    await act(async () => {
      render(<RemoteSyncIndicator projectId="proj-1" />);
    });
    expect(screen.getByLabelText("Sync from remote error")).toBeDefined();
  });

  it("renders nothing when API returns 404", async () => {
    const { ApiError } = await import("@/lib/api/client");
    mockGetConfig.mockRejectedValue(new ApiError(404, "Not Found", "Not found"));
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <RemoteSyncIndicator projectId="proj-1" />
      );
      container = result.container;
    });
    expect(container!.innerHTML).toBe("");
  });

  it("passes accessToken to API call", async () => {
    mockGetConfig.mockResolvedValue({ enabled: false, status: "idle" });
    await act(async () => {
      render(
        <RemoteSyncIndicator projectId="proj-1" accessToken="tok-123" />
      );
    });
    expect(mockGetConfig).toHaveBeenCalledWith("proj-1", "tok-123");
  });
});

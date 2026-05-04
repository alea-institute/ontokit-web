import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { PullRequest, PRListResponse } from "@/lib/api/pullRequests";

// Mock pullRequestsApi
const mockList = vi.fn();

vi.mock("@/lib/api/pullRequests", () => ({
  pullRequestsApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  GitPullRequest: () => <span data-testid="icon-git-pr" />,
}));

// Mock PRListItem
vi.mock("@/components/pr/PRListItem", () => ({
  PRListItem: ({ pr, projectId }: { pr: PullRequest; projectId: string }) => (
    <div data-testid={`pr-item-${pr.id}`}>
      {pr.title} - {projectId}
    </div>
  ),
}));

import { PRList } from "@/components/pr/PRList";

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: "pr-1",
    project_id: "proj-1",
    pr_number: 1,
    title: "Test PR",
    source_branch: "feature/test",
    target_branch: "main",
    status: "open",
    author_id: "user-1",
    created_at: new Date().toISOString(),
    review_count: 0,
    approval_count: 0,
    comment_count: 0,
    commits_ahead: 1,
    can_merge: true,
    ...overrides,
  };
}

function makeListResponse(
  items: PullRequest[],
  total: number
): PRListResponse {
  return { items, total, skip: 0, limit: 20 };
}

describe("PRList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    // Never resolve to keep loading state
    mockList.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <PRList projectId="proj-1" accessToken="token-123" />
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders status filter tabs", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Open")).toBeDefined();
    });
    expect(screen.getByText("Merged")).toBeDefined();
    expect(screen.getByText("Closed")).toBeDefined();
    expect(screen.getByText("All")).toBeDefined();
  });

  it("renders total count", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("0 pull requests")).toBeDefined();
    });
  });

  it("renders singular pull request text for total of 1", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([makePR()], 1));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("1 pull request")).toBeDefined();
    });
  });

  it("renders empty state for open filter", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(
      <PRList projectId="proj-1" accessToken="token-123" defaultStatus="open" />
    );

    await waitFor(() => {
      expect(screen.getByText("No pull requests")).toBeDefined();
    });
    expect(
      screen.getByText(
        "There are no open pull requests for this project."
      )
    ).toBeDefined();
  });

  it("renders empty state for merged filter", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("No pull requests")).toBeDefined();
    });

    // Switch to merged tab
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    await act(async () => {
      fireEvent.click(screen.getByText("Merged"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("No pull requests have been merged yet.")
      ).toBeDefined();
    });
  });

  it("renders empty state for closed filter", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("No pull requests")).toBeDefined();
    });

    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    await act(async () => {
      fireEvent.click(screen.getByText("Closed"));
    });

    await waitFor(() => {
      expect(
        screen.getByText("No pull requests have been closed.")
      ).toBeDefined();
    });
  });

  it("renders empty state for all filter", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("No pull requests")).toBeDefined();
    });

    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    await act(async () => {
      fireEvent.click(screen.getByText("All"));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "No pull requests have been created for this project."
        )
      ).toBeDefined();
    });
  });

  it("renders PR items when data is available", async () => {
    const prs = [
      makePR({ id: "pr-1", title: "First PR" }),
      makePR({ id: "pr-2", title: "Second PR" }),
    ];
    mockList.mockResolvedValueOnce(makeListResponse(prs, 2));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("pr-item-pr-1")).toBeDefined();
      expect(screen.getByTestId("pr-item-pr-2")).toBeDefined();
    });
  });

  it("renders error state", async () => {
    mockList.mockRejectedValueOnce(new Error("Network error"));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("shows generic error for non-Error exceptions", async () => {
    mockList.mockRejectedValueOnce("something");
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load pull requests")).toBeDefined();
    });
  });

  it("calls API with correct params for status filter", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(
      <PRList projectId="proj-1" accessToken="token-123" defaultStatus="open" />
    );

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        "proj-1",
        "token-123",
        "open",
        undefined,
        0,
        20
      );
    });
  });

  it("passes undefined status when filter is all", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(
      <PRList
        projectId="proj-1"
        accessToken="token-123"
        defaultStatus="all"
      />
    );

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        "proj-1",
        "token-123",
        undefined,
        undefined,
        0,
        20
      );
    });
  });

  it("changes status filter and resets skip to 0", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(1);
    });

    mockList.mockResolvedValueOnce(makeListResponse([], 0));
    await act(async () => {
      fireEvent.click(screen.getByText("Merged"));
    });

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        "proj-1",
        "token-123",
        "merged",
        undefined,
        0,
        20
      );
    });
  });

  it("renders pagination when total exceeds limit", async () => {
    const prs = Array.from({ length: 20 }, (_, i) =>
      makePR({ id: `pr-${i}`, title: `PR ${i}` })
    );
    mockList.mockResolvedValueOnce(makeListResponse(prs, 25));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Previous")).toBeDefined();
      expect(screen.getByText("Next")).toBeDefined();
      expect(screen.getByText("1-20 of 25")).toBeDefined();
    });
  });

  it("Previous button is disabled on first page", async () => {
    const prs = [makePR()];
    mockList.mockResolvedValueOnce(makeListResponse(prs, 25));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      const prevBtn = screen.getByText("Previous");
      expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("navigates to next page", async () => {
    const prs = Array.from({ length: 20 }, (_, i) =>
      makePR({ id: `pr-${i}`, title: `PR ${i}` })
    );
    mockList.mockResolvedValueOnce(makeListResponse(prs, 25));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeDefined();
    });

    mockList.mockResolvedValueOnce(
      makeListResponse([makePR({ id: "pr-20" })], 25)
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Next"));
    });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        "proj-1",
        "token-123",
        "open",
        undefined,
        20,
        20
      );
    });
  });

  it("does not render pagination when total is within limit", async () => {
    mockList.mockResolvedValueOnce(makeListResponse([makePR()], 1));
    render(<PRList projectId="proj-1" accessToken="token-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("pr-item-pr-1")).toBeDefined();
    });

    expect(screen.queryByText("Previous")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });
});

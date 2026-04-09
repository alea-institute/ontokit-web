import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { PullRequest } from "@/lib/api/pullRequests";

// ---- mocks (must precede component import) ----

vi.mock("@/lib/api/pullRequests", () => ({
  pullRequestsApi: {
    get: vi.fn(),
    merge: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    createReview: vi.fn(),
  },
}));

vi.mock("@/lib/api/revisions", () => ({
  branchesApi: {
    list: vi.fn().mockResolvedValue({ items: [], current_branch: "main" }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
    children?: React.ReactNode;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    title,
    description,
    confirmLabel,
    children,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => Promise<void> | void;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: string;
    children?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span data-testid="dialog-title">{title}</span>
        <span data-testid="dialog-description">{description}</span>
        {children}
        <button data-testid="dialog-confirm" onClick={onConfirm}>
          {confirmLabel || "Confirm"}
        </button>
      </div>
    ) : null,
}));

import { PRActions } from "@/components/pr/PRActions";
import { pullRequestsApi } from "@/lib/api/pullRequests";
import { branchesApi } from "@/lib/api/revisions";

// ---- helpers ----

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: "pr-1",
    project_id: "proj-1",
    pr_number: 7,
    title: "Add owl:Thing subclass",
    description: "Description text",
    source_branch: "feature/thing",
    target_branch: "main",
    status: "open",
    author_id: "user-1",
    author: { id: "user-1", name: "Alice" },
    created_at: "2025-06-01T10:00:00Z",
    review_count: 0,
    approval_count: 0,
    comment_count: 0,
    commits_ahead: 1,
    can_merge: true,
    ...overrides,
  };
}

const mockPrApi = pullRequestsApi as unknown as {
  get: ReturnType<typeof vi.fn>;
  merge: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  reopen: ReturnType<typeof vi.fn>;
  createReview: ReturnType<typeof vi.fn>;
};

const mockBranchesApi = branchesApi as unknown as {
  list: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const defaultProps = {
  projectId: "proj-1",
  accessToken: "tok-123",
  onUpdate: vi.fn(),
};

// ---- tests ----

describe("PRActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBranchesApi.list.mockResolvedValue({ items: [], current_branch: "main" });
  });

  // -- open PR: merge button visibility --

  it("shows merge button for owners when PR is open and can_merge", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ can_merge: true })} userRole="owner" />
    );
    expect(screen.getByText("Merge")).toBeDefined();
  });

  it("shows merge button for admins when PR is open", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ can_merge: true })} userRole="admin" />
    );
    expect(screen.getByText("Merge")).toBeDefined();
  });

  it("hides merge button for editors", () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="editor" />
    );
    expect(screen.queryByText("Merge")).toBeNull();
  });

  it("hides merge button for viewers", () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="viewer" />
    );
    expect(screen.queryByText("Merge")).toBeNull();
  });

  it("disables merge button when can_merge is false", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ can_merge: false })} userRole="owner" />
    );
    const mergeBtn = screen.getByText("Merge");
    expect(mergeBtn.hasAttribute("disabled")).toBe(true);
  });

  it("shows approval requirement message when can_merge is false for admin", () => {
    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ can_merge: false, approval_count: 0 })}
        userRole="admin"
      />
    );
    expect(
      screen.getByText(/requires additional approvals/)
    ).toBeDefined();
    expect(screen.getByText(/0 approvals/)).toBeDefined();
  });

  // -- open PR: close button --

  it("shows close button for open PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="editor" />
    );
    expect(screen.getByText("Close")).toBeDefined();
  });

  // -- open PR: review form --

  it("shows review button for open PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" />
    );
    expect(screen.getByText("Review")).toBeDefined();
  });

  it("toggles review form on click", async () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" />
    );
    fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("Submit Review")).toBeDefined();
    expect(screen.getByPlaceholderText("Leave a comment (optional)")).toBeDefined();
  });

  it("shows approve and request changes buttons in review form for owners", async () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" />
    );
    fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("Approve")).toBeDefined();
    expect(screen.getByText("Request Changes")).toBeDefined();
    expect(screen.getByText("Comment")).toBeDefined();
  });

  it("hides approve/request-changes for editors in review form", async () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="editor" />
    );
    fireEvent.click(screen.getByText("Review"));
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Request Changes")).toBeNull();
    // Comment button should still be visible
    expect(screen.getByText("Comment")).toBeDefined();
  });

  it("closes review form on cancel", () => {
    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" />
    );
    fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("Submit Review")).toBeDefined();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Submit Review")).toBeNull();
  });

  // -- merge action via confirm dialog --

  it("opens merge confirm dialog and calls merge on confirm", async () => {
    const mergedPR = makePR({ status: "merged", merged_at: "2025-06-10T10:00:00Z" });
    mockPrApi.merge.mockResolvedValue({ success: true, message: "Merged" });
    mockPrApi.get.mockResolvedValue(mergedPR);
    const onUpdate = vi.fn();

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ can_merge: true })}
        userRole="owner"
        onUpdate={onUpdate}
      />
    );

    // Click merge to open dialog
    fireEvent.click(screen.getByText("Merge"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
      expect(screen.getByTestId("dialog-title").textContent).toBe("Merge Pull Request");
    });

    // Confirm the merge
    await act(async () => {
      fireEvent.click(screen.getByTestId("dialog-confirm"));
    });

    await waitFor(() => {
      expect(mockPrApi.merge).toHaveBeenCalledWith(
        "proj-1",
        7,
        { delete_source_branch: true },
        "tok-123"
      );
      expect(onUpdate).toHaveBeenCalledWith(mergedPR);
    });
  });

  // -- close action --

  it("opens close confirm dialog and calls close on confirm", async () => {
    const closedPR = makePR({ status: "closed" });
    mockPrApi.close.mockResolvedValue(closedPR);
    const onUpdate = vi.fn();

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="editor" onUpdate={onUpdate} />
    );

    fireEvent.click(screen.getByText("Close"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-title").textContent).toBe("Close Pull Request");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("dialog-confirm"));
    });

    await waitFor(() => {
      expect(mockPrApi.close).toHaveBeenCalledWith("proj-1", 7, "tok-123");
      expect(onUpdate).toHaveBeenCalledWith(closedPR);
    });
  });

  // -- closed PR: reopen --

  it("shows reopen button for owners on closed PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ status: "closed" })} userRole="owner" />
    );
    expect(screen.getByText("Reopen")).toBeDefined();
  });

  it("shows reopen button for admins on closed PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ status: "closed" })} userRole="admin" />
    );
    expect(screen.getByText("Reopen")).toBeDefined();
  });

  it("hides reopen button for editors on closed PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ status: "closed" })} userRole="editor" />
    );
    expect(screen.queryByText("Reopen")).toBeNull();
  });

  it("hides reopen button for viewers on closed PRs", () => {
    render(
      <PRActions {...defaultProps} pr={makePR({ status: "closed" })} userRole="viewer" />
    );
    expect(screen.queryByText("Reopen")).toBeNull();
  });

  it("calls reopen API via confirm dialog", async () => {
    const reopenedPR = makePR({ status: "open" });
    mockPrApi.reopen.mockResolvedValue(reopenedPR);
    const onUpdate = vi.fn();

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "closed" })}
        userRole="owner"
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText("Reopen"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-title").textContent).toBe(
        "Reopen Pull Request"
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("dialog-confirm"));
    });

    await waitFor(() => {
      expect(mockPrApi.reopen).toHaveBeenCalledWith("proj-1", 7, "tok-123");
      expect(onUpdate).toHaveBeenCalledWith(reopenedPR);
    });
  });

  // -- merged PR --

  it("shows merged state with 'Continue to Editor' link", async () => {
    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged", merged_at: "2025-06-10T00:00:00Z" })}
        userRole="owner"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Continue to Editor")).toBeDefined();
    });
    const link = screen.getByText("Continue to Editor").closest("a");
    expect(link?.getAttribute("href")).toBe("/projects/proj-1/editor?branch=main");
  });

  it("shows merged message referencing target branch", async () => {
    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged", target_branch: "develop" })}
        userRole="owner"
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/merged into/)).toBeDefined();
      expect(screen.getByText("develop")).toBeDefined();
    });
  });

  it("shows 'Checking branch...' while source branch existence is loading", () => {
    // Make branchesApi.list never resolve
    mockBranchesApi.list.mockReturnValue(new Promise(() => {}));

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged" })}
        userRole="owner"
      />
    );
    expect(screen.getByText("Checking branch...")).toBeDefined();
  });

  it("shows delete branch button when source branch exists after merge", async () => {
    mockBranchesApi.list.mockResolvedValue({
      items: [{ name: "feature/thing" }, { name: "main" }],
      current_branch: "main",
    });

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged", source_branch: "feature/thing" })}
        userRole="owner"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Delete Branch/)).toBeDefined();
    });
  });

  it("shows 'Branch deleted' message when source branch does not exist", async () => {
    mockBranchesApi.list.mockResolvedValue({
      items: [{ name: "main" }],
      current_branch: "main",
    });

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged", source_branch: "feature/thing" })}
        userRole="owner"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/deleted/)).toBeDefined();
    });
  });

  it("calls branchesApi.delete when delete branch is confirmed", async () => {
    mockBranchesApi.list.mockResolvedValue({
      items: [{ name: "feature/thing" }, { name: "main" }],
      current_branch: "main",
    });
    mockBranchesApi.delete.mockResolvedValue(undefined);

    render(
      <PRActions
        {...defaultProps}
        pr={makePR({ status: "merged", source_branch: "feature/thing" })}
        userRole="owner"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Delete Branch/)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Delete Branch/));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
      expect(screen.getByTestId("dialog-title").textContent).toBe("Delete Branch");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("dialog-confirm"));
    });

    await waitFor(() => {
      expect(mockBranchesApi.delete).toHaveBeenCalledWith(
        "proj-1",
        "feature/thing",
        "tok-123"
      );
    });
  });

  // -- review submission --

  it("submits an approval review", async () => {
    const updatedPR = makePR({ approval_count: 1 });
    mockPrApi.createReview.mockResolvedValue({
      id: "rev-1",
      status: "approved",
    });
    mockPrApi.get.mockResolvedValue(updatedPR);
    const onUpdate = vi.fn();

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" onUpdate={onUpdate} />
    );

    // Open review form
    fireEvent.click(screen.getByText("Review"));

    // Type a review body
    const textarea = screen.getByPlaceholderText("Leave a comment (optional)");
    fireEvent.change(textarea, { target: { value: "LGTM" } });

    // Click approve
    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    await waitFor(() => {
      expect(mockPrApi.createReview).toHaveBeenCalledWith(
        "proj-1",
        7,
        { status: "approved", body: "LGTM" },
        "tok-123"
      );
      expect(onUpdate).toHaveBeenCalledWith(updatedPR);
    });
  });

  it("submits a request-changes review", async () => {
    mockPrApi.createReview.mockResolvedValue({
      id: "rev-1",
      status: "changes_requested",
    });
    mockPrApi.get.mockResolvedValue(makePR());

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="admin" onUpdate={vi.fn()} />
    );

    fireEvent.click(screen.getByText("Review"));
    await act(async () => {
      fireEvent.click(screen.getByText("Request Changes"));
    });

    await waitFor(() => {
      expect(mockPrApi.createReview).toHaveBeenCalledWith(
        "proj-1",
        7,
        { status: "changes_requested", body: undefined },
        "tok-123"
      );
    });
  });

  it("submits a comment-only review", async () => {
    mockPrApi.createReview.mockResolvedValue({
      id: "rev-1",
      status: "commented",
    });
    mockPrApi.get.mockResolvedValue(makePR());

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="editor" onUpdate={vi.fn()} />
    );

    fireEvent.click(screen.getByText("Review"));
    const textarea = screen.getByPlaceholderText("Leave a comment (optional)");
    fireEvent.change(textarea, { target: { value: "Thoughts" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Comment"));
    });

    await waitFor(() => {
      expect(mockPrApi.createReview).toHaveBeenCalledWith(
        "proj-1",
        7,
        { status: "commented", body: "Thoughts" },
        "tok-123"
      );
    });
  });

  // -- error display --

  it("displays error when review submission fails", async () => {
    mockPrApi.createReview.mockRejectedValue(new Error("Server error"));

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" onUpdate={vi.fn()} />
    );

    fireEvent.click(screen.getByText("Review"));
    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("displays generic error for non-Error exceptions", async () => {
    mockPrApi.createReview.mockRejectedValue("some string error");

    render(
      <PRActions {...defaultProps} pr={makePR()} userRole="owner" onUpdate={vi.fn()} />
    );

    fireEvent.click(screen.getByText("Review"));
    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to submit review")).toBeDefined();
    });
  });
});

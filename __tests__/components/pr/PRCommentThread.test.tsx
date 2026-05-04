import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Comment } from "@/lib/api/pullRequests";

// Mock pullRequestsApi
const mockCreateComment = vi.fn();
const mockUpdateComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock("@/lib/api/pullRequests", () => ({
  pullRequestsApi: {
    createComment: (...args: unknown[]) => mockCreateComment(...args),
    updateComment: (...args: unknown[]) => mockUpdateComment(...args),
    deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Reply: () => <span data-testid="icon-reply" />,
  Edit: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
  User: () => <span data-testid="icon-user" />,
  CornerDownRight: () => <span data-testid="icon-corner" />,
}));

import { PRCommentThread } from "@/components/pr/PRCommentThread";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    pull_request_id: "pr-1",
    author_id: "user-1",
    author: { id: "user-1", name: "Alice" },
    body: "Looks good!",
    created_at: "2025-01-15T12:00:00Z",
    replies: [],
    ...overrides,
  };
}

const defaultProps = {
  projectId: "proj-1",
  prNumber: 42,
  accessToken: "token-123",
  currentUserId: "user-1",
  onCommentsChange: vi.fn(),
};

describe("PRCommentThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders empty state when no comments", () => {
    render(<PRCommentThread {...defaultProps} comments={[]} />);
    expect(
      screen.getByText("No comments yet. Be the first to comment!")
    ).toBeDefined();
  });

  it("renders a comment with author name and body", () => {
    const comment = makeComment({ body: "This is a test comment" });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("This is a test comment")).toBeDefined();
  });

  it("falls back to author_id when author name is absent", () => {
    const comment = makeComment({ author: undefined, author_id: "user-xyz" });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.getByText("user-xyz")).toBeDefined();
  });

  it("shows (edited) when updated_at differs from created_at", () => {
    const comment = makeComment({
      created_at: "2025-01-15T12:00:00Z",
      updated_at: "2025-01-15T13:00:00Z",
    });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.getByText("(edited)")).toBeDefined();
  });

  it("does not show (edited) when updated_at equals created_at", () => {
    const comment = makeComment({
      created_at: "2025-01-15T12:00:00Z",
      updated_at: "2025-01-15T12:00:00Z",
    });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.queryByText("(edited)")).toBeNull();
  });

  it("shows edit and delete buttons for own comments", () => {
    const comment = makeComment({ author_id: "user-1" });
    render(
      <PRCommentThread {...defaultProps} currentUserId="user-1" comments={[comment]} />
    );
    expect(screen.getByTitle("Edit")).toBeDefined();
    expect(screen.getByTitle("Delete")).toBeDefined();
  });

  it("does not show edit/delete buttons for other users comments", () => {
    const comment = makeComment({ author_id: "user-2" });
    render(
      <PRCommentThread {...defaultProps} currentUserId="user-1" comments={[comment]} />
    );
    expect(screen.queryByTitle("Edit")).toBeNull();
    expect(screen.queryByTitle("Delete")).toBeNull();
  });

  it("shows Reply button for top-level comments", () => {
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.getByText("Reply")).toBeDefined();
  });

  it("renders nested replies", () => {
    const reply = makeComment({
      id: "c2",
      author_id: "user-2",
      author: { id: "user-2", name: "Bob" },
      body: "Thanks!",
    });
    const comment = makeComment({ replies: [reply] });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("Thanks!")).toBeDefined();
  });

  it("opens reply form when Reply button is clicked", () => {
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByText("Reply"));
    expect(screen.getByPlaceholderText("Write a reply...")).toBeDefined();
  });

  it("submits a reply and calls onCommentsChange", async () => {
    mockCreateComment.mockResolvedValueOnce({});
    const onCommentsChange = vi.fn();
    const comment = makeComment();
    render(
      <PRCommentThread
        {...defaultProps}
        onCommentsChange={onCommentsChange}
        comments={[comment]}
      />
    );

    fireEvent.click(screen.getByText("Reply"));
    const textarea = screen.getByPlaceholderText("Write a reply...");
    fireEvent.change(textarea, { target: { value: "My reply" } });

    // Click the Reply submit button (there are two "Reply" texts, the submit button is the second)
    const replyButtons = screen.getAllByText("Reply");
    const submitReply = replyButtons[replyButtons.length - 1];
    fireEvent.click(submitReply);

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalledWith(
        "proj-1",
        42,
        { body: "My reply", parent_id: "c1" },
        "token-123"
      );
    });

    await waitFor(() => {
      expect(onCommentsChange).toHaveBeenCalled();
    });
  });

  it("does not submit reply when body is empty", async () => {
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByText("Reply"));
    // Leave textarea empty and click reply submit
    const replyButtons = screen.getAllByText("Reply");
    fireEvent.click(replyButtons[replyButtons.length - 1]);

    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it("cancels reply form", () => {
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByText("Reply"));
    expect(screen.getByPlaceholderText("Write a reply...")).toBeDefined();

    // Click Cancel in the reply form
    const cancelButtons = screen.getAllByText("Cancel");
    fireEvent.click(cancelButtons[0]);

    expect(screen.queryByPlaceholderText("Write a reply...")).toBeNull();
  });

  it("opens edit mode and shows textarea with comment body", () => {
    const comment = makeComment({ body: "Original body" });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByTitle("Edit"));
    // The textarea should contain the original body
    const textarea = screen.getByDisplayValue("Original body");
    expect(textarea).toBeDefined();
  });

  it("submits edit and calls onCommentsChange", async () => {
    mockUpdateComment.mockResolvedValueOnce({});
    const onCommentsChange = vi.fn();
    const comment = makeComment({ body: "Original body" });
    render(
      <PRCommentThread
        {...defaultProps}
        onCommentsChange={onCommentsChange}
        comments={[comment]}
      />
    );

    fireEvent.click(screen.getByTitle("Edit"));
    const textarea = screen.getByDisplayValue("Original body");
    fireEvent.change(textarea, { target: { value: "Updated body" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateComment).toHaveBeenCalledWith(
        "proj-1",
        42,
        "c1",
        { body: "Updated body" },
        "token-123"
      );
    });

    await waitFor(() => {
      expect(onCommentsChange).toHaveBeenCalled();
    });
  });

  it("cancels edit mode", () => {
    const comment = makeComment({ body: "Original body" });
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByTitle("Edit"));
    expect(screen.getByDisplayValue("Original body")).toBeDefined();

    fireEvent.click(screen.getByText("Cancel"));
    // Should show the body text again, not a textarea
    expect(screen.getByText("Original body")).toBeDefined();
    expect(screen.queryByDisplayValue("Original body")).toBeNull();
  });

  it("deletes a comment after confirmation", async () => {
    mockDeleteComment.mockResolvedValueOnce({});
    const onCommentsChange = vi.fn();
    const comment = makeComment();
    render(
      <PRCommentThread
        {...defaultProps}
        onCommentsChange={onCommentsChange}
        comments={[comment]}
      />
    );

    fireEvent.click(screen.getByTitle("Delete"));

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith(
        "proj-1",
        42,
        "c1",
        "token-123"
      );
    });

    await waitFor(() => {
      expect(onCommentsChange).toHaveBeenCalled();
    });
  });

  it("does not delete when confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByTitle("Delete"));
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });

  it("handles reply API error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateComment.mockRejectedValueOnce(new Error("Network error"));
    const comment = makeComment();
    render(<PRCommentThread {...defaultProps} comments={[comment]} />);

    fireEvent.click(screen.getByText("Reply"));
    const textarea = screen.getByPlaceholderText("Write a reply...");
    fireEvent.change(textarea, { target: { value: "A reply" } });
    const replyButtons = screen.getAllByText("Reply");
    fireEvent.click(replyButtons[replyButtons.length - 1]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to reply:", expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it("renders multiple top-level comments", () => {
    const comments = [
      makeComment({ id: "c1", body: "First comment" }),
      makeComment({ id: "c2", body: "Second comment", author_id: "user-2", author: { id: "user-2", name: "Bob" } }),
    ];
    render(<PRCommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText("First comment")).toBeDefined();
    expect(screen.getByText("Second comment")).toBeDefined();
  });
});

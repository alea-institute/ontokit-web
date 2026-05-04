import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PullRequest } from "@/lib/api/pullRequests";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { PRListItem } from "@/components/pr/PRListItem";

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: "pr-1",
    project_id: "proj-1",
    pr_number: 42,
    title: "Add Person class",
    source_branch: "feature/person",
    target_branch: "main",
    status: "open",
    author_id: "user-1",
    author: { id: "user-1", name: "Alice" },
    created_at: new Date().toISOString(),
    review_count: 0,
    approval_count: 0,
    comment_count: 0,
    commits_ahead: 1,
    can_merge: true,
    ...overrides,
  };
}

describe("PRListItem", () => {
  it("renders the PR title", () => {
    render(<PRListItem pr={makePR()} projectId="proj-1" />);
    expect(screen.getByText("Add Person class")).toBeDefined();
  });

  it("renders the PR number", () => {
    render(<PRListItem pr={makePR()} projectId="proj-1" />);
    expect(screen.getByText("#42")).toBeDefined();
  });

  it("links to the correct PR URL", () => {
    render(<PRListItem pr={makePR()} projectId="proj-1" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/projects/proj-1/pull-requests/42");
  });

  it("renders branch names", () => {
    render(<PRListItem pr={makePR()} projectId="proj-1" />);
    expect(screen.getByText("feature/person")).toBeDefined();
    expect(screen.getByText("main")).toBeDefined();
    expect(screen.getByText("into")).toBeDefined();
  });

  it("shows Open badge for open PRs", () => {
    render(<PRListItem pr={makePR({ status: "open" })} projectId="proj-1" />);
    expect(screen.getByText("Open")).toBeDefined();
  });

  it("shows Merged badge for merged PRs", () => {
    render(<PRListItem pr={makePR({ status: "merged" })} projectId="proj-1" />);
    expect(screen.getByText("Merged")).toBeDefined();
  });

  it("shows Closed badge for closed PRs", () => {
    render(<PRListItem pr={makePR({ status: "closed" })} projectId="proj-1" />);
    expect(screen.getByText("Closed")).toBeDefined();
  });

  it("shows author name", () => {
    render(<PRListItem pr={makePR()} projectId="proj-1" />);
    expect(screen.getByText("Alice")).toBeDefined();
  });

  it("falls back to author_id when author name is absent", () => {
    render(
      <PRListItem
        pr={makePR({ author: undefined, author_id: "user-abc" })}
        projectId="proj-1"
      />
    );
    expect(screen.getByText("user-abc")).toBeDefined();
  });

  it("shows comment count when > 0", () => {
    render(
      <PRListItem pr={makePR({ comment_count: 5 })} projectId="proj-1" />
    );
    expect(screen.getByText("5")).toBeDefined();
  });

  it("does not show comment count when 0", () => {
    render(
      <PRListItem pr={makePR({ comment_count: 0 })} projectId="proj-1" />
    );
    // Only the PR number "42" and commits count should be rendered, not a standalone "0"
    // for comments
    const allText = screen.queryAllByText("0");
    // Comment count should not contribute a "0" element
    // (commits_ahead is 1, so no "0" for that either)
    expect(allText.length).toBe(0);
  });

  it("shows approval count when > 0", () => {
    render(
      <PRListItem pr={makePR({ approval_count: 2 })} projectId="proj-1" />
    );
    expect(screen.getByText("2 approved")).toBeDefined();
  });

  it("shows commits ahead count", () => {
    render(
      <PRListItem pr={makePR({ commits_ahead: 3 })} projectId="proj-1" />
    );
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("commits")).toBeDefined();
  });

  it("shows singular commit text for 1 commit ahead", () => {
    render(
      <PRListItem pr={makePR({ commits_ahead: 1 })} projectId="proj-1" />
    );
    expect(screen.getByText("commit")).toBeDefined();
  });

  it("does not show commits section when commits_ahead is 0", () => {
    render(
      <PRListItem pr={makePR({ commits_ahead: 0 })} projectId="proj-1" />
    );
    expect(screen.queryByText("commit")).toBeNull();
    expect(screen.queryByText("commits")).toBeNull();
  });

  it("renders GitHub link when github_pr_url is provided", () => {
    render(
      <PRListItem
        pr={makePR({ github_pr_url: "https://github.com/org/repo/pull/1" })}
        projectId="proj-1"
      />
    );
    const ghLink = screen.getByText("View on GitHub");
    expect(ghLink.getAttribute("href")).toBe(
      "https://github.com/org/repo/pull/1"
    );
    expect(ghLink.getAttribute("target")).toBe("_blank");
  });

  it("does not render GitHub link when github_pr_url is absent", () => {
    render(
      <PRListItem pr={makePR({ github_pr_url: undefined })} projectId="proj-1" />
    );
    expect(screen.queryByText("View on GitHub")).toBeNull();
  });

  it("merges custom className", () => {
    render(
      <PRListItem pr={makePR()} projectId="proj-1" className="extra" />
    );
    const link = screen.getByRole("link");
    expect(link.className).toContain("extra");
  });

  it("shows 'merged' date for merged PRs", () => {
    const mergedAt = "2025-01-15T12:00:00Z";
    render(
      <PRListItem
        pr={makePR({
          status: "merged",
          merged_at: mergedAt,
        })}
        projectId="proj-1"
      />
    );
    // Verify merged status badge is shown
    expect(screen.getAllByText(/merged/i).length).toBeGreaterThan(0);
    // Verify the merged date is rendered alongside the status
    expect(screen.getByText(/merged.*15/)).toBeDefined();
  });
});

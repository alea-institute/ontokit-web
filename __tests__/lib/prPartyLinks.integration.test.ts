import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isTrustedGitHubLink, trustedGitHubUrl } from "@/lib/prPartyLinks";
import { QAThread } from "@/components/pr-party/QAThread";
import type { PRPartyQAEntry } from "@/lib/api/prParty";

afterEach(cleanup);

describe("PR Party URL trust boundary", () => {
  it.each([undefined, null, 42, {}, "", "/pull/1", "https://[invalid", "//github.com/owner/repo"])("rejects non-absolute or non-string input %j", (input) => {
    expect(trustedGitHubUrl(input)).toBeNull();
    expect(isTrustedGitHubLink(input)).toBe(false);
  });

  it("canonicalizes hostname, default port and path segments without dropping query or fragment", () => {
    expect(trustedGitHubUrl("HTTPS://GITHUB.COM:443/owner/old/../repo/pull/1?q=review#issuecomment-2")).toBe("https://github.com/owner/repo/pull/1?q=review#issuecomment-2");
    expect(isTrustedGitHubLink("https://github.com/owner/repo")).toBe(true);
  });

  it("keeps third-party Q&A bodies visible while rendering anchors only for trusted comment URLs", () => {
    const base: PRPartyQAEntry = {
      question_comment_id: "question-1", question_body: "<img src=x onerror=alert(1)>",
      question_author: "reviewer", question_url: "https://github.com/owner/repo/pull/1#issuecomment-1",
      asked_at: "2026-09-19T01:00:00Z", answer_comment_id: "answer-1", answer_body: "Answer text",
      answer_author: "author", answer_url: "https://github.com.evil.example/answer", answered_at: null,
    };
    const { container, rerender } = render(React.createElement(QAThread, {
      cardId: "trust-test", reviewerId: "reviewer-test", entries: [base], prUrl: "https://github.com/owner/repo/pull/1",
      onAsk: async () => { throw new Error("No submission expected"); },
    }));
    expect(screen.getByText(base.question_body)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "See it on GitHub" }).getAttribute("href")).toBe(base.question_url);
    expect(screen.queryByRole("link", { name: "See the answer on GitHub" })).toBeNull();
    rerender(React.createElement(QAThread, {
      cardId: "trust-test", reviewerId: "reviewer-test", entries: [{ ...base, question_url: "javascript:alert(1)", answer_url: "https://github.com/owner/repo/pull/1#issuecomment-2" }],
      prUrl: "https://github.com/owner/repo/pull/1", onAsk: async () => { throw new Error("No submission expected"); },
    }));
    expect(screen.queryByRole("link", { name: "See it on GitHub" })).toBeNull();
    const answer = screen.getByRole("link", { name: "See the answer on GitHub" });
    expect(answer.getAttribute("rel")).toBe("noopener noreferrer");
    expect(answer.getAttribute("target")).toBe("_blank");
  });
});

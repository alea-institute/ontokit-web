/**
 * U12 — the expanded card: brief detail, deep links, and the merge control.
 *
 * The load-bearing property here is C5: a merge receipt is the only thing that
 * may be reported as a merge. GitHub can accept the call and decline the merge
 * (branch protection, a race), and the dashboard must never round that up to
 * "merged". The second property is AE5: whether a merge is one tap or a link
 * out is the reviewer's stored default, not a global.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PRPartyActionResponse,
  PRPartyCardDetail,
  PRPartyQueueCard,
} from "@/lib/api/prParty";

vi.mock("@/lib/hooks/usePRPartyQueue", () => ({
  usePRPartyCard: vi.fn(),
  usePRPartyQueue: vi.fn(),
  usePRPartySettings: vi.fn(),
}));

import {
  usePRPartyCard,
  usePRPartyQueue,
  usePRPartySettings,
} from "@/lib/hooks/usePRPartyQueue";
import { CardDetail } from "@/components/pr-party/CardDetail";

const mockedCard = usePRPartyCard as unknown as ReturnType<typeof vi.fn>;
const mockedQueue = usePRPartyQueue as unknown as ReturnType<typeof vi.fn>;
const mockedSettings = usePRPartySettings as unknown as ReturnType<typeof vi.fn>;

// --- Fixtures ---

function makeCard(overrides: Partial<PRPartyQueueCard> = {}): PRPartyQueueCard {
  return {
    card_id: "card-1",
    repo_full_name: "catholicos/ontokit-api",
    pr_number: 42,
    title: "Add the reconciler",
    author_kind: "counterpart",
    author_github_login: "frjohn",
    read_only: false,
    state: "open",
    head_sha: "aaa111",
    mergeable_state: "clean",
    checks_rollup: "success",
    brief_status: "ready",
    brief_truncated: false,
    ready_at: "2026-07-26T10:00:00Z",
    updated_at_github: "2026-07-26T10:00:00Z",
    pr_url: "https://github.com/catholicos/ontokit-api/pull/42",
    diff_url: "https://github.com/catholicos/ontokit-api/pull/42/files",
    readiness: { ready: true, reason: null },
    actions: [],
    other_reviewer: { has_approved: true, has_pending_intent: false },
    stale: false,
    parked: false,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<PRPartyCardDetail> = {}): PRPartyCardDetail {
  return {
    ...makeCard(),
    brief_what: "Adds a reconciler.",
    brief_why: "Webhooks drop.",
    brief_decisions: ["Poll every five minutes."],
    brief_links: [],
    truncated_note: null,
    brewing_since: null,
    created_at: "2026-07-26T09:00:00Z",
    updated_at: "2026-07-26T10:00:00Z",
    qa_thread: [],
    ...overrides,
  };
}

function makeActionResponse(
  overrides: Partial<PRPartyActionResponse> = {},
): PRPartyActionResponse {
  return {
    action: {
      kind: "merge",
      verdict: null,
      status: "merged",
      head_sha: "aaa111",
      override: false,
      created_at: "2026-07-26T12:00:00Z",
      merged: true,
    },
    card: makeDetail(),
    ...overrides,
  };
}

const submitAction = vi.fn();
const askQuestion = vi.fn();

function setup({
  detail = makeDetail(),
  isLoading = false,
  isError = false,
  mergeDefault = "dashboard",
}: {
  detail?: PRPartyCardDetail | null;
  isLoading?: boolean;
  isError?: boolean;
  mergeDefault?: string;
} = {}) {
  mockedCard.mockReturnValue({
    card: detail,
    isLoading,
    isError,
    error: isError ? new Error("nope") : null,
    refetch: vi.fn(),
  });
  mockedQueue.mockReturnValue({
    submitAction,
    isSubmittingAction: false,
    askQuestion,
    isAskingQuestion: false,
  });
  mockedSettings.mockReturnValue({
    settings: { merge_default: mergeDefault, ntfy_topic: null },
    isLoading: false,
    isError: false,
  });
}

function renderDetail(card: PRPartyQueueCard = makeCard()) {
  return render(<CardDetail card={card} />);
}

describe("CardDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    submitAction.mockResolvedValue(makeActionResponse());
    askQuestion.mockResolvedValue({
      posted: true,
      degraded: false,
      body: "q",
      comment_id: "c-1",
      comment_url: "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-1",
      deep_link: null,
      card: makeDetail(),
    });
  });

  // --- Brief + deep links ---

  it("renders the brief and the PR deep links", () => {
    setup();
    const { container } = renderDetail();

    expect(screen.getByText("Adds a reconciler.")).toBeTruthy();
    expect(screen.getByText("Webhooks drop.")).toBeTruthy();
    expect(screen.getByText("Poll every five minutes.")).toBeTruthy();

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("https://github.com/catholicos/ontokit-api/pull/42");
    expect(hrefs).toContain("https://github.com/catholicos/ontokit-api/pull/42/files");
  });

  it("shows the truncation note when the brief was cut", () => {
    setup({ detail: makeDetail({ brief_truncated: true, truncated_note: "Diff too big." }) });
    renderDetail();
    expect(screen.getByText("Diff too big.")).toBeTruthy();
  });

  it("renders brief text and links from a hostile brief inertly", () => {
    const hostile = '<script>alert(1)</script>';
    setup({
      detail: makeDetail({
        brief_what: hostile,
        brief_links: ["javascript:alert(1)", "https://evil.test/x"],
      }),
    });
    const { container } = renderDetail();

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(hostile)).toBeTruthy();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.some((h) => h?.startsWith("javascript:"))).toBe(false);
    expect(hrefs).not.toContain("https://evil.test/x");
  });

  it("omits hostile API-derived PR and diff navigation targets", () => {
    setup({
      detail: makeDetail({
        pr_url: "javascript:alert(1)",
        diff_url: "https://github.com.attacker.example/files",
      }),
    });
    const { container } = renderDetail();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("explains why merge is unavailable until the other reviewer approves", () => {
    setup({ detail: makeDetail({ other_reviewer: { has_approved: false, has_pending_intent: false } }) });
    renderDetail();
    expect(screen.queryByRole("button", { name: /merge pull request/i })).toBeNull();
    expect(screen.getByText(/unavailable until the other reviewer approves/i)).toBeTruthy();
  });

  it("shows a loading state while the detail is in flight", () => {
    setup({ detail: null, isLoading: true });
    renderDetail();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows an error with a way out to GitHub when the detail fails", () => {
    setup({ detail: null, isError: true });
    const { container } = renderDetail();
    expect(screen.getByRole("alert")).toBeTruthy();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("https://github.com/catholicos/ontokit-api/pull/42");
  });

  // --- AE5: merge control follows the reviewer's default ---

  it("offers a one-tap merge when the reviewer's default is dashboard", () => {
    setup({ mergeDefault: "dashboard" });
    renderDetail();
    expect(screen.getByRole("button", { name: /merge pull request/i })).toBeTruthy();
  });

  it("offers only a link to GitHub when the reviewer's default is manual", () => {
    setup({ mergeDefault: "manual" });
    const { container } = renderDetail();

    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
    const mergeLink = Array.from(container.querySelectorAll("a")).find((a) =>
      /merge/i.test(a.textContent ?? ""),
    );
    expect(mergeLink?.getAttribute("href")).toBe(
      "https://github.com/catholicos/ontokit-api/pull/42",
    );
  });

  it("leaves an own PR's merge to the card, so there is only ever one button", () => {
    setup({ detail: makeDetail({ read_only: true }) });
    renderDetail(makeCard({ read_only: true }));
    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
  });

  it("offers no merge control on a closed PR", () => {
    setup({ detail: makeDetail({ state: "closed" }) });
    renderDetail(makeCard({ state: "closed" }));
    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
  });

  // --- C5: only a receipt with merged === true may be reported as merged ---

  it("reports a merge only when the receipt says merged", async () => {
    const user = userEvent.setup();
    setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /merge pull request/i }));

    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).toBe("merged");
    expect(outcome.textContent).toMatch(/merged/i);
    expect(submitAction).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: "card-1", actionKind: "merge", headSha: "aaa111" }),
    );
  });

  it("does not claim a merge when GitHub skipped it", async () => {
    const user = userEvent.setup();
    setup();
    submitAction.mockResolvedValue(
      makeActionResponse({
        action: {
          kind: "merge",
          verdict: null,
          status: "skipped",
          head_sha: "aaa111",
          override: false,
          created_at: "2026-07-26T12:00:00Z",
          merged: false,
        },
        deep_link: "https://github.com/catholicos/ontokit-api/pull/42",
      }),
    );
    renderDetail();

    await user.click(screen.getByRole("button", { name: /merge pull request/i }));

    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).toBe("skipped");
    expect(outcome.textContent).toMatch(/not merged/i);
    expect(outcome.querySelector("a")?.getAttribute("href")).toBe(
      "https://github.com/catholicos/ontokit-api/pull/42",
    );
  });

  it("does not claim a merge when the receipt omits the merged flag", async () => {
    const user = userEvent.setup();
    setup();
    submitAction.mockResolvedValue(
      makeActionResponse({
        action: {
          kind: "merge",
          verdict: null,
          status: "recorded",
          head_sha: "aaa111",
          override: false,
          created_at: "2026-07-26T12:00:00Z",
        },
      }),
    );
    renderDetail();

    await user.click(screen.getByRole("button", { name: /merge pull request/i }));

    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).not.toBe("merged");
    expect(outcome.textContent).toMatch(/not merged/i);
  });

  it("renders a failed merge distinctly, with the deep link", async () => {
    const user = userEvent.setup();
    setup();
    submitAction.mockRejectedValue(new Error("Branch protection said no"));
    renderDetail();

    await user.click(screen.getByRole("button", { name: /merge pull request/i }));

    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).toBe("failed");
    expect(outcome.textContent).toContain("Branch protection said no");
    expect(outcome.querySelector("a")?.getAttribute("href")).toBe(
      "https://github.com/catholicos/ontokit-api/pull/42",
    );
  });

  // --- The thread is wired to the card ---

  it("mounts the Q&A thread against this card", async () => {
    const user = userEvent.setup();
    setup({
      detail: makeDetail({
        qa_thread: [
          {
            question_comment_id: "c-1",
            question_body: "Why poll?",
            question_author: "damienriehl",
            question_url:
              "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-1",
            asked_at: "2026-07-26T10:00:00Z",
            answer_comment_id: null,
            answer_body: null,
            answer_author: null,
            answer_url: null,
            answered_at: null,
          },
        ],
      }),
    });
    renderDetail();

    expect(screen.getByText("Why poll?")).toBeTruthy();
    expect(screen.getByText(/no answer yet/i)).toBeTruthy();

    await user.type(screen.getByLabelText(/ask the author/i), "And retries?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    await waitFor(() =>
      expect(askQuestion).toHaveBeenCalledWith({
        cardId: "card-1",
        question: "And retries?",
      }),
    );
  });
});

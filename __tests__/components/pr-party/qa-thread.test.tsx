/**
 * U12 — the Q&A thread on a PR Party card.
 *
 * The thread is the reviewer's only in-dashboard way to talk to the PR author,
 * so the properties under test are the ones that decide whether a question is
 * really out there: a pending state while it posts, an honest "no answer yet"
 * when GitHub has none, and — when the token is dead — a compose-for-copy panel
 * that says plainly that nothing was posted. Bodies come from GitHub and are
 * rendered as text nodes only (R21).
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PRPartyCommentResponse, PRPartyQAEntry } from "@/lib/api/prParty";

// This jsdom environment ships an incomplete localStorage; the composer's draft
// persistence needs a real one. Same shim as CreditModal's tests.
vi.hoisted(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    },
  });
});

import { QAThread, qaDraftKey } from "@/components/pr-party/QAThread";

function makeEntry(overrides: Partial<PRPartyQAEntry> = {}): PRPartyQAEntry {
  return {
    question_comment_id: "c-1",
    question_body: "Does this drop the webhook path?",
    question_author: "damienriehl",
    question_url: "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-1",
    asked_at: "2026-07-26T10:00:00Z",
    answer_comment_id: null,
    answer_body: null,
    answer_author: null,
    answer_url: null,
    answered_at: null,
    ...overrides,
  };
}

function makeCommentResponse(
  overrides: Partial<PRPartyCommentResponse> = {},
): PRPartyCommentResponse {
  return {
    posted: true,
    degraded: false,
    body: "Does this drop the webhook path?",
    comment_id: "c-9",
    comment_url: "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-9",
    deep_link: null,
    // The refreshed card is not read by the thread; the queue hook re-fetches.
    card: null as never,
    ...overrides,
  };
}

function renderThread(props: Partial<React.ComponentProps<typeof QAThread>> = {}) {
  const onAsk = props.onAsk ?? vi.fn().mockResolvedValue(makeCommentResponse());
  const utils = render(
    <QAThread
      cardId="card-1"
      entries={[]}
      prUrl="https://github.com/catholicos/ontokit-api/pull/42"
      onAsk={onAsk}
      {...props}
    />,
  );
  return { ...utils, onAsk };
}

describe("QAThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // --- AE4 (UI half): asking ---

  it("submits the question and shows a pending state while it posts", async () => {
    const user = userEvent.setup();
    let resolve: ((value: PRPartyCommentResponse) => void) | undefined;
    const onAsk = vi.fn(
      () =>
        new Promise<PRPartyCommentResponse>((r) => {
          resolve = r;
        }),
    );

    renderThread({ onAsk });

    await user.type(screen.getByLabelText(/ask the author/i), "Why poll?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    expect(onAsk).toHaveBeenCalledWith({ cardId: "card-1", question: "Why poll?" });
    expect(screen.getByTestId("pr-party-question-pending")).toBeTruthy();

    resolve?.(makeCommentResponse());
    await waitFor(() =>
      expect(screen.queryByTestId("pr-party-question-pending")).toBeNull(),
    );
  });

  it("does not submit an empty question", async () => {
    const user = userEvent.setup();
    const { onAsk } = renderThread();

    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    expect(onAsk).not.toHaveBeenCalled();
  });

  it("clears the composer after a question really posts", async () => {
    const user = userEvent.setup();
    renderThread();

    const box = screen.getByLabelText(/ask the author/i) as HTMLTextAreaElement;
    await user.type(box, "Why poll?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    await waitFor(() => expect(box.value).toBe(""));
  });

  // --- AE4 (UI half): reading the thread ---

  it("renders an answered entry as question and answer text", () => {
    renderThread({
      entries: [
        makeEntry({
          answer_comment_id: "c-2",
          answer_body: "No — the poll is a backstop.",
          answer_author: "frjohn",
          answer_url:
            "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-2",
          answered_at: "2026-07-26T11:00:00Z",
        }),
      ],
    });

    expect(screen.getByText("Does this drop the webhook path?")).toBeTruthy();
    expect(screen.getByText("No — the poll is a backstop.")).toBeTruthy();
    expect(screen.getByText(/frjohn/)).toBeTruthy();
    expect(screen.queryByText(/no answer yet/i)).toBeNull();
  });

  it("shows 'no answer yet' and a re-ask affordance for an unanswered entry", async () => {
    const user = userEvent.setup();
    renderThread({ entries: [makeEntry()] });

    expect(screen.getByText(/no answer yet/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /ask again/i }));

    expect((screen.getByLabelText(/ask the author/i) as HTMLTextAreaElement).value).toBe(
      "Does this drop the webhook path?",
    );
  });

  it("renders hostile question and answer bodies inert, as text", () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { container } = renderThread({
      entries: [
        makeEntry({
          question_body: hostile,
          answer_comment_id: "c-2",
          answer_body: hostile,
          answer_author: "attacker",
          answer_url: "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-2",
          answered_at: "2026-07-26T11:00:00Z",
        }),
      ],
    });

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(hostile).length).toBe(2);
  });

  it("only links a question whose url is a github.com url", () => {
    const { container } = renderThread({
      entries: [
        makeEntry({ question_url: "javascript:alert(1)" }),
        makeEntry({
          question_comment_id: "c-2",
          question_url: "https://github.com/catholicos/ontokit-api/pull/42#issuecomment-2",
        }),
      ],
    });

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.some((h) => h?.startsWith("javascript:"))).toBe(false);
    expect(
      hrefs.includes("https://github.com/catholicos/ontokit-api/pull/42#issuecomment-2"),
    ).toBe(true);
  });

  // --- R12/R27: degraded compose-for-copy ---

  it("shows compose-for-copy with the exact body and a deep link when degraded", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const onAsk = vi.fn().mockResolvedValue(
      makeCommentResponse({
        posted: false,
        degraded: true,
        body: "Why poll?\n\n— asked from OntoKit",
        comment_id: null,
        comment_url: null,
        deep_link: "https://github.com/catholicos/ontokit-api/pull/42",
      }),
    );

    renderThread({ onAsk });

    await user.type(screen.getByLabelText(/ask the author/i), "Why poll?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    const panel = await screen.findByTestId("pr-party-question-degraded");
    expect(panel.textContent).toContain("Why poll?\n\n— asked from OntoKit");
    // Honest: nothing was posted.
    expect(panel.textContent).toMatch(/not posted|nothing was posted/i);

    const link = panel.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "https://github.com/catholicos/ontokit-api/pull/42",
    );

    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("Why poll?\n\n— asked from OntoKit");
  });

  it("omits a hostile degraded Q&A link and hostile PR fallback", async () => {
    const user = userEvent.setup();
    const { container } = renderThread({
      prUrl: "https://ontokit.example/pr-party",
      onAsk: vi.fn().mockResolvedValue(
        makeCommentResponse({
          posted: false,
          degraded: true,
          deep_link: "https://github.com\\@attacker.example/x",
        }),
      ),
    });
    await user.type(screen.getByRole("textbox"), "Why?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));
    await screen.findByTestId("pr-party-question-degraded");
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps the draft when nothing was posted", async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn().mockResolvedValue(
      makeCommentResponse({ posted: false, degraded: true, body: "Why poll?" }),
    );
    renderThread({ onAsk });

    const box = screen.getByLabelText(/ask the author/i) as HTMLTextAreaElement;
    await user.type(box, "Why poll?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    await screen.findByTestId("pr-party-question-degraded");
    expect(box.value).toBe("Why poll?");
  });

  it("surfaces a failure without claiming the question was asked", async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn().mockRejectedValue(new Error("GitHub said no"));
    renderThread({ onAsk });

    await user.type(screen.getByLabelText(/ask the author/i), "Why poll?");
    await user.click(screen.getByRole("button", { name: /ask on the pull request/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("GitHub said no");
  });

  // --- Draft persistence across the re-auth navigation ---

  it("persists the draft across unmount and remount", async () => {
    const user = userEvent.setup();
    const { unmount } = renderThread();

    await user.type(screen.getByLabelText(/ask the author/i), "Half a question");
    expect(window.localStorage.getItem(qaDraftKey("card-1"))).toBe("Half a question");

    unmount();
    renderThread();

    expect((screen.getByLabelText(/ask the author/i) as HTMLTextAreaElement).value).toBe(
      "Half a question",
    );
  });

  it("keeps drafts separate per card", async () => {
    const user = userEvent.setup();
    const { unmount } = renderThread();
    await user.type(screen.getByLabelText(/ask the author/i), "Card one draft");
    unmount();

    renderThread({ cardId: "card-2" });
    expect((screen.getByLabelText(/ask the author/i) as HTMLTextAreaElement).value).toBe(
      "",
    );
  });
});

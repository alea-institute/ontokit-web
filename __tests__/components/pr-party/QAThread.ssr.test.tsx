// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QAThread } from "@/components/pr-party/QAThread";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";
import type { PRPartyQAEntry } from "@/lib/api/prParty";

const entry: PRPartyQAEntry = {
  question_comment_id: "question", question_body: "Why <this> change?", question_author: "Reviewer",
  question_url: "https://github.com/example/ontology/pull/1#issuecomment-1", asked_at: "2026-09-19T12:00:00Z",
  answer_comment_id: "answer", answer_body: "To clarify the definition.", answer_author: "Author",
  answer_url: "https://github.com/example/ontology/pull/1#issuecomment-2", answered_at: null,
};

describe("review questions rendered before browser storage is available", () => {
  it.each([false, true])("renders the composer and server thread (answered: %s)", answered => {
    expect(typeof window).toBe("undefined");
    const onAsk = vi.fn();
    const html = renderToStaticMarkup(<ScreenReaderAnnouncerProvider><QAThread
      cardId="card" reviewerId="reviewer" entries={answered ? [entry] : []}
      prUrl="https://github.com/example/ontology/pull/1" onAsk={onAsk}
    /></ScreenReaderAnnouncerProvider>);
    expect(html).toContain("Ask the author a question");
    expect(html).toContain('<textarea');
    expect(onAsk).not.toHaveBeenCalled();
    if (answered) {
      expect(html).toContain("Why &lt;this&gt; change?");
      expect(html).toContain("To clarify the definition.");
      expect(html).toContain('data-answered="true"');
    } else expect(html).toContain("No questions on this pull request yet.");
  });
});

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";
import { isTrustedGitHubLink } from "@/components/pr-party/PRPartyCard";
import type { PRPartyCommentResponse, PRPartyQAEntry } from "@/lib/api/prParty";
import { cn } from "@/lib/utils";

/**
 * The Q&A thread on a PR Party card (R13/R14/R27).
 *
 * Three things are load-bearing here.
 *
 * **The thread never claims more than it knows.** A question is "asked" only
 * when the server says it posted. When the reviewer's token is dead the server
 * returns `posted: false` with the exact body it *would* have posted; the panel
 * says nothing was posted, hands over the text to copy, and links to the PR.
 * Silently keeping a question that never left the building is the failure mode
 * this whole affordance exists to prevent.
 *
 * **An unanswered question stays visibly unanswered.** GitHub has no notion of
 * "the answer to this question", so an entry with no answer renders as one and
 * offers to re-ask rather than pretending the silence means agreement.
 *
 * **Bodies are third-party text.** Question and answer bodies are GitHub
 * markdown written by whoever opened the PR. They are rendered as text nodes,
 * never through a markdown pipeline or `dangerouslySetInnerHTML` (R21), and a
 * comment URL becomes an anchor only if it is a github.com URL.
 *
 * The composer's draft survives unmount, because the thing most likely to
 * unmount it is SessionGuard's forced re-auth — losing a half-written question
 * to a token expiry the user never saw coming is the same class of loss.
 */

const DRAFT_PREFIX = "prparty";

/** localStorage key for one card's in-progress question. */
export function qaDraftKey(cardId: string): string {
  return `${DRAFT_PREFIX}:${cardId}`;
}

function readDraft(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    // Private mode, disabled storage: a lost draft is not worth an exception.
    return "";
  }
}

/**
 * A draft that outlives the component. Deliberately not the Zustand draft store
 * — that store is keyed to ontology entities and persists a rich shape; this is
 * one string per card, and a bespoke key in the same namespace style is less
 * machinery than widening the store's type union for it.
 */
function useLocalDraft(key: string): [string, (next: string) => void] {
  const [value, setValue] = useState(() => readDraft(key));

  // The panel is remounted per card in some layouts and reused in others.
  useEffect(() => {
    setValue(readDraft(key));
  }, [key]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        if (next) window.localStorage.setItem(key, next);
        else window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable — the in-memory value still works this session */
      }
    },
    [key],
  );

  return [value, update];
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export interface QAThreadProps {
  cardId: string;
  entries: PRPartyQAEntry[];
  /** Where to send someone who has to finish the conversation by hand. */
  prUrl: string;
  onAsk: (vars: { cardId: string; question: string }) => Promise<PRPartyCommentResponse>;
}

interface DegradedCompose {
  body: string;
  deepLink: string;
}

export function QAThread({ cardId, entries, prUrl, onAsk }: QAThreadProps) {
  const { announce } = useAnnounce();
  const [draft, setDraft] = useLocalDraft(qaDraftKey(cardId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState<DegradedCompose | null>(null);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  const label = `pr-party-question-${cardId}`;

  async function handleAsk() {
    const question = draft.trim();
    if (!question || pending) return;

    setError(null);
    setCompose(null);
    setCopied(false);
    setPending(true);
    try {
      const response = await onAsk({ cardId, question });
      if (response.posted && !response.degraded) {
        setDraft("");
        announce("Question posted on the pull request.");
      } else {
        // Nothing left the building. Keep the draft — the reviewer may want to
        // try again once the token is back — and hand over the exact body.
        setCompose({
          body: response.body ?? question,
          deepLink: response.deep_link ?? prUrl,
        });
        announce(
          "Your question was not posted. Copy it and post it on GitHub yourself.",
          "assertive",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not ask the question";
      setError(message);
      announce(`Your question was not asked: ${message}`, "assertive");
    } finally {
      setPending(false);
    }
  }

  async function handleCopy(body: string) {
    try {
      await navigator.clipboard?.writeText(body);
      setCopied(true);
      announce("Question copied.");
    } catch {
      setCopied(false);
    }
  }

  function reAsk(body: string) {
    setDraft(body);
    boxRef.current?.focus();
  }

  return (
    <section className="mt-4" data-testid="pr-party-qa-thread" aria-label="Questions">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
        Questions
      </h3>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No questions on this pull request yet.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {entries.map((entry) => {
            const answered = entry.answer_body !== null;
            return (
              <li
                key={entry.question_comment_id}
                data-testid="pr-party-qa-entry"
                data-answered={answered ? "true" : "false"}
                className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {entry.question_author} asked {formatWhen(entry.asked_at)}
                </p>
                {/* Text node only — third-party markdown (R21). */}
                <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                  {entry.question_body}
                </p>
                {isTrustedGitHubLink(entry.question_url) && (
                  <a
                    href={entry.question_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary-700 underline dark:text-primary-300"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    See it on GitHub
                  </a>
                )}

                {answered ? (
                  <div className="mt-2 border-l-2 border-emerald-400 pl-3 dark:border-emerald-600">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.answer_author} answered {formatWhen(entry.answered_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                      {entry.answer_body}
                    </p>
                    {entry.answer_url && isTrustedGitHubLink(entry.answer_url) && (
                      <a
                        href={entry.answer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary-700 underline dark:text-primary-300"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        See the answer on GitHub
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      No answer yet.
                    </span>
                    <button
                      type="button"
                      onClick={() => reAsk(entry.question_body)}
                      className="text-sm font-medium text-primary-700 underline dark:text-primary-300"
                    >
                      Ask again
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Composer */}
      <div className="mt-3">
        <label
          htmlFor={label}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Ask the author a question
        </label>
        <textarea
          id={label}
          ref={boxRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className={cn(
            "mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900",
            "focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500",
            "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
          )}
          placeholder="It posts as a comment on the pull request."
        />

        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        {pending && (
          <p
            data-testid="pr-party-question-pending"
            className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Posting your question to GitHub…
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          className="mt-2 min-h-11 w-full sm:w-auto"
          disabled={pending || draft.trim().length === 0}
          onClick={handleAsk}
        >
          Ask on the pull request
        </Button>
      </div>

      {compose && (
        <div
          data-testid="pr-party-question-degraded"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/20"
        >
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Not posted — GitHub would not take it.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Nothing was posted on your behalf. Copy the question and post it yourself.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {compose.body}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => handleCopy(compose.body)}
            >
              {copied ? "Copied" : "Copy the question"}
            </Button>
            <a
              href={compose.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-300"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Post it yourself on GitHub
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

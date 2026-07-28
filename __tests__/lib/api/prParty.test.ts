import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  prPartyApi,
  mintIdempotencyKey,
  parsePRPartyError,
  isPRPartyDriftError,
  isPRPartyInFlightError,
  IDEMPOTENCY_KEY_PATTERN,
} from "@/lib/api/prParty";
import { ApiError } from "@/lib/api/client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function lastCall() {
  const [url, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return {
    url: url as string,
    options: options as RequestInit & { retryOn5xx?: boolean },
    headers: new Headers(options.headers as HeadersInit),
    body: options.body ? JSON.parse(options.body as string) : undefined,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("prPartyApi reads", () => {
  it("getMe calls the capability endpoint with a bearer token", async () => {
    mockOk({ is_reviewer: true, degraded: false, github_login: "dr" });

    const result = await prPartyApi.getMe("tok");
    expect(result).toEqual({ is_reviewer: true, degraded: false, github_login: "dr" });

    const { url, options, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/me");
    expect(options.method).toBe("GET");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("getQueue threads the token and keeps default retry behavior", async () => {
    mockOk({ generated_at: "2026-07-26T00:00:00Z", cards: [] });

    await prPartyApi.getQueue("tok");

    const { url, options, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/queue");
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(options.method).toBe("GET");
  });

  it("getCard encodes the card id and sends the token", async () => {
    mockOk({ card_id: "a/b#1" });

    await prPartyApi.getCard("a/b#1", "tok");

    const { url, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/");
    expect(url).toContain(encodeURIComponent("a/b#1"));
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("getSettings reads the reviewer settings", async () => {
    mockOk({ merge_default: "squash", ntfy_topic: "t" });
    await prPartyApi.getSettings("tok");

    const { url, options } = lastCall();
    expect(url).toContain("/api/v1/pr-party/settings");
    expect(options.method).toBe("GET");
  });
});

describe("prPartyApi actuations", () => {
  it("submitAction posts the verdict with an idempotency key and no 5xx retry", async () => {
    mockOk({ action: {}, card: {} });

    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123", body: "lgtm" },
      "tok",
    );

    const { url, options, headers, body } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/card-1/actions");
    expect(options.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(body.action_kind).toBe("review");
    expect(body.head_sha).toBe("abc123");
    expect(body.idempotency_key).toMatch(IDEMPOTENCY_KEY_PATTERN);
  });

  it("an identical action after definitive success creates a NEW attempt", async () => {
    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123" },
      "tok",
    );
    const first = lastCall().body.idempotency_key;

    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123" },
      "tok",
    );
    expect(lastCall().body.idempotency_key).not.toBe(first);
  });

  it("an uncertain retry reuses its attempt key", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("network connection lost"));
    await expect(
      prPartyApi.submitAction(
        "uncertain-card",
        { action_kind: "review", verdict: "approve", head_sha: "abc123" },
        "tok",
      ),
    ).rejects.toThrow("network connection lost");
    const first = lastCall().body.idempotency_key;

    mockOk({});
    await prPartyApi.submitAction(
      "uncertain-card",
      { action_kind: "review", verdict: "approve", head_sha: "abc123" },
      "tok",
    );
    expect(lastCall().body.idempotency_key).toBe(first);
  });

  it("submitAction mints a DIFFERENT key when the reviewer's note changes", async () => {
    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123", body: "lgtm" },
      "tok",
    );
    const first = lastCall().body.idempotency_key;

    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      {
        action_kind: "review",
        verdict: "approve",
        head_sha: "abc123",
        body: "actually, rename the helper",
      },
      "tok",
    );
    expect(lastCall().body.idempotency_key).not.toBe(first);
    expect(lastCall().body.idempotency_key).toMatch(IDEMPOTENCY_KEY_PATTERN);
  });

  it("submitAction mints a DIFFERENT key when the reviewer overrides a block", async () => {
    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123" },
      "tok",
    );
    const first = lastCall().body.idempotency_key;

    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      { action_kind: "review", verdict: "approve", head_sha: "abc123", override: true },
      "tok",
    );
    expect(lastCall().body.idempotency_key).not.toBe(first);
  });

  it("submitAction honors an explicitly supplied idempotency key", async () => {
    mockOk({});
    await prPartyApi.submitAction(
      "card-1",
      {
        action_kind: "merge",
        head_sha: "abc123",
        merge_method: "squash",
        idempotency_key: "caller-supplied-key",
      },
      "tok",
    );
    expect(lastCall().body.idempotency_key).toBe("caller-supplied-key");
  });

  it("makes exactly one fetch call when a verdict hits a 500", async () => {
    // The whole point of retryOn5xx: false — a retried POST would submit the
    // review twice.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("boom"),
    });

    await expect(
      prPartyApi.submitAction(
        "card-1",
        { action_kind: "review", verdict: "approve", head_sha: "abc123" },
        "tok",
      ),
    ).rejects.toThrow(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("unpark posts to the card and opts out of retry", async () => {
    mockOk({ card_id: "card-1" });
    await prPartyApi.unpark("card-1", "tok");

    const { url, options, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/card-1/unpark");
    expect(options.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("askQuestion posts the question body", async () => {
    mockOk({ posted: true });
    await prPartyApi.askQuestion("card-1", "why this shape?", "tok");

    const { url, body, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/card-1/questions");
    expect(body).toEqual({ question: "why this shape?" });
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("addNote posts the note body", async () => {
    mockOk({ posted: true });
    await prPartyApi.addNote("card-1", "parking this", "tok");

    const { url, body } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/card-1/notes");
    expect(body).toEqual({ note: "parking this" });
  });

  it("rerunReview posts with no body", async () => {
    mockOk({ posted: true });
    await prPartyApi.rerunReview("card-1", "tok");

    const { url, options } = lastCall();
    expect(url).toContain("/api/v1/pr-party/cards/card-1/rerun-review");
    expect(options.method).toBe("POST");
    expect(options.body).toBeUndefined();
  });

  it("setCredential PUTs the token under the token field", async () => {
    mockOk({});
    await prPartyApi.setCredential("ghp_secret", "tok");

    const { url, options, body, headers } = lastCall();
    expect(url).toContain("/api/v1/pr-party/credential");
    expect(options.method).toBe("PUT");
    expect(body).toEqual({ token: "ghp_secret" });
    // The session token, not the PAT, authenticates the call.
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("revokeCredential DELETEs the credential", async () => {
    mockOk({ revoked_locally: true, revoke_url: "https://github.com/settings/tokens" });
    const result = await prPartyApi.revokeCredential("tok");
    expect(result.revoke_url).toContain("github.com");

    const { options } = lastCall();
    expect(options.method).toBe("DELETE");
  });

  it("updateSettings PUTs only the changed fields", async () => {
    mockOk({});
    await prPartyApi.updateSettings({ ntfy_topic: "my-topic" }, "tok");

    const { url, options, body } = lastCall();
    expect(url).toContain("/api/v1/pr-party/settings");
    expect(options.method).toBe("PUT");
    expect(body).toEqual({ ntfy_topic: "my-topic" });
  });
});

describe("5xx retry posture", () => {
  // The opt-out is invisible in the fetch init (the client strips it), so the
  // only honest proof is the attempt count.
  //
  // The two tables below are *derived from the module's own surface*, not
  // hand-listed. A hardcoded list of eight silently stops covering the ninth
  // method — and the ninth method is exactly the one whose author forgot
  // `actuationOptions()`. Enumerating `prPartyApi` means a new method has to be
  // registered here before the suite goes green, and registering it runs the
  // retry-posture assertion against it.
  //
  // The read/actuation split follows the module's naming convention: `get*` is
  // a read, everything else changes something on GitHub or in the row.
  const invocations: Record<string, () => Promise<unknown>> = {
    getMe: () => prPartyApi.getMe("tok"),
    getQueue: () => prPartyApi.getQueue("tok"),
    getCard: () => prPartyApi.getCard("card-1", "tok"),
    getSettings: () => prPartyApi.getSettings("tok"),
    submitAction: () =>
      prPartyApi.submitAction(
        "card-1",
        { action_kind: "review", verdict: "approve", head_sha: "abc123" },
        "tok",
      ),
    unpark: () => prPartyApi.unpark("card-1", "tok"),
    askQuestion: () => prPartyApi.askQuestion("card-1", "q", "tok"),
    addNote: () => prPartyApi.addNote("card-1", "n", "tok"),
    rerunReview: () => prPartyApi.rerunReview("card-1", "tok"),
    setCredential: () => prPartyApi.setCredential("ghp_x", "tok"),
    revokeCredential: () => prPartyApi.revokeCredential("tok"),
    updateSettings: () => prPartyApi.updateSettings({ ntfy_topic: "t" }, "tok"),
  };

  const methodNames = Object.keys(prPartyApi).sort();
  const isRead = (name: string) => name.startsWith("get");
  const actuations: [string, () => Promise<unknown>][] = methodNames
    .filter((name) => !isRead(name))
    .map((name) => [name, invocations[name]]);
  const reads: [string, () => Promise<unknown>][] = methodNames
    .filter(isRead)
    .map((name) => [name, invocations[name]]);

  it("covers every method the module exports", () => {
    // Fails the moment someone adds a method without saying how to call it —
    // which is the moment its retry posture stops being tested.
    expect(methodNames.filter((name) => !(name in invocations))).toEqual([]);
    // And the other direction: a stale entry for a method that no longer exists.
    expect(Object.keys(invocations).filter((name) => !methodNames.includes(name))).toEqual(
      [],
    );
    expect(actuations.length).toBeGreaterThan(0);
    expect(reads.length).toBeGreaterThan(0);
  });

  it.each(actuations)("%s makes exactly one attempt on a 500", async (_name, call) => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("boom"),
    });

    await expect(call()).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each(reads)(
    "%s keeps the default retry — a flaky read is worth retrying",
    async (_name, call) => {
      vi.useFakeTimers();
      try {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve("down"),
        });

        let caught: unknown;
        const handled = call().catch((e) => {
          caught = e;
        });
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await handled;

        expect(caught).toBeInstanceOf(ApiError);
        expect(mockFetch).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe("mintIdempotencyKey", () => {
  it("always produces a server-acceptable key", () => {
    const keys = Array.from({ length: 20 }, () => mintIdempotencyKey());
    keys.forEach((k) => {
      expect(k).toMatch(IDEMPOTENCY_KEY_PATTERN);
      expect(k.length).toBeGreaterThanOrEqual(8);
      expect(k.length).toBeLessThanOrEqual(64);
    });
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("PR Party error shapes", () => {
  function apiError(status: number, detail: unknown) {
    return new ApiError(status, "Conflict", JSON.stringify({ detail }));
  }

  it("surfaces the fresh card on a 409 drift response", () => {
    const err = apiError(409, {
      message: "The pull request changed while you were reading it.",
      card: { card_id: "card-1", head_sha: "newsha" },
    });

    const detail = parsePRPartyError(err);
    expect(detail?.card?.head_sha).toBe("newsha");
    expect(isPRPartyDriftError(err)).toBe(true);
    expect(isPRPartyInFlightError(err)).toBe(false);
  });

  it("distinguishes a 409 in-flight response, which carries no card", () => {
    const err = apiError(409, { message: "action in flight" });

    expect(isPRPartyDriftError(err)).toBe(false);
    expect(isPRPartyInFlightError(err)).toBe(true);
    expect(parsePRPartyError(err)?.message).toBe("action in flight");
  });

  it("surfaces the retire hint on a derived-retirement conflict", () => {
    const err = apiError(409, { message: "already merged", retire: true, reason: "merged" });
    const detail = parsePRPartyError(err);
    expect(detail?.retire).toBe(true);
    expect(detail?.reason).toBe("merged");
  });

  it("returns null for non-PR-Party errors and unparseable bodies", () => {
    expect(parsePRPartyError(new Error("nope"))).toBeNull();
    expect(parsePRPartyError(new ApiError(500, "Server Error", "not json"))).toBeNull();
    expect(isPRPartyDriftError(new ApiError(500, "Server Error", "not json"))).toBe(false);
  });

  it("accepts a plain-string FastAPI detail", () => {
    const err = new ApiError(403, "Forbidden", JSON.stringify({ detail: "not a reviewer" }));
    expect(parsePRPartyError(err)?.message).toBe("not a reviewer");
  });

  it("does not treat a non-409 card-bearing error as drift", () => {
    const err = apiError(422, { message: "bad", card: { card_id: "c" } });
    expect(isPRPartyDriftError(err)).toBe(false);
  });
});

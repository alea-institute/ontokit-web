import { describe, expect, it, vi } from "vitest";
import { saveSuggestionUpdate } from "@/lib/editor/suggestionSessionPersistence";

function makeSession(overrides: Partial<{
  startSession: () => Promise<string | null>;
  saveToSession: () => Promise<boolean>;
}> = {}) {
  return {
    startSession: vi.fn().mockResolvedValue("suggest/session-1"),
    saveToSession: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeOptions(session: ReturnType<typeof makeSession>) {
  return {
    isSessionActive: false,
    session,
    content: "updated ontology",
    entityIri: "http://example.org/ont#Entity",
    entityLabel: "Entity",
    onSaved: vi.fn(),
  };
}

describe("saveSuggestionUpdate", () => {
  it("does not publish local success state when the session cannot start", async () => {
    const session = makeSession({ startSession: vi.fn().mockResolvedValue(null) });
    const options = makeOptions(session);

    await expect(saveSuggestionUpdate(options)).rejects.toThrow(/could not start/i);

    expect(session.saveToSession).not.toHaveBeenCalled();
    expect(options.onSaved).not.toHaveBeenCalled();
  });

  it("does not publish local success state when the session save fails", async () => {
    const session = makeSession({ saveToSession: vi.fn().mockResolvedValue(false) });
    const options = makeOptions(session);

    await expect(saveSuggestionUpdate(options)).rejects.toThrow(/not saved/i);

    expect(options.onSaved).not.toHaveBeenCalled();
  });

  it("publishes local success state only after the session save succeeds", async () => {
    const session = makeSession();
    const options = makeOptions(session);

    await saveSuggestionUpdate(options);

    expect(session.startSession).toHaveBeenCalledTimes(1);
    expect(session.saveToSession).toHaveBeenCalledWith(
      "updated ontology",
      "http://example.org/ont#Entity",
      "Entity",
    );
    expect(options.onSaved).toHaveBeenCalledTimes(1);
  });

  it("saves directly when the suggestion session is already active", async () => {
    const session = makeSession();
    const options = { ...makeOptions(session), isSessionActive: true };

    await saveSuggestionUpdate(options);

    expect(session.startSession).not.toHaveBeenCalled();
    expect(session.saveToSession).toHaveBeenCalledWith(
      "updated ontology",
      "http://example.org/ont#Entity",
      "Entity",
    );
    expect(options.onSaved).toHaveBeenCalledTimes(1);
  });
});

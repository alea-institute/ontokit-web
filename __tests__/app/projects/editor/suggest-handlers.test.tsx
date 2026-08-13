import { describe, expect, it, vi } from "vitest";
import {
  persistClassSuggestionUpdate,
  persistIndividualSuggestionUpdate,
  persistPropertySuggestionUpdate,
} from "@/app/projects/[id]/editor/page";

const handlers = [
  ["class", persistClassSuggestionUpdate],
  ["property", persistPropertySuggestionUpdate],
  ["individual", persistIndividualSuggestionUpdate],
] as const;

describe.each(handlers)(
  "%s suggestion handler",
  (entityType, persistSuggestionUpdate) => {
    it("creates a session, saves with its returned id, then reports success", async () => {
      const startSession = vi.fn().mockResolvedValue("sess-new");
      const saveToSession = vi.fn().mockResolvedValue(undefined);
      const onSuccess = vi.fn();

      await persistSuggestionUpdate(
        { sessionId: null, startSession, saveToSession },
        `${entityType} content`,
        `http://example.test/${entityType}`,
        entityType,
        onSuccess,
      );

      expect(startSession).toHaveBeenCalledOnce();
      expect(saveToSession).toHaveBeenCalledWith(
        `${entityType} content`,
        `http://example.test/${entityType}`,
        entityType,
        "sess-new",
      );
      expect(onSuccess).toHaveBeenCalledOnce();
      expect(saveToSession.mock.invocationCallOrder[0]).toBeLessThan(
        onSuccess.mock.invocationCallOrder[0],
      );
    });

    it("uses the existing session without creating another one", async () => {
      const startSession = vi.fn();
      const saveToSession = vi.fn().mockResolvedValue(undefined);

      await persistSuggestionUpdate(
        { sessionId: "sess-existing", startSession, saveToSession },
        "content",
        `http://example.test/${entityType}`,
        entityType,
        vi.fn(),
      );

      expect(startSession).not.toHaveBeenCalled();
      expect(saveToSession).toHaveBeenCalledWith(
        "content",
        `http://example.test/${entityType}`,
        entityType,
        "sess-existing",
      );
    });

    it("surfaces a failed save without reporting success", async () => {
      const error = new Error("Save failed");
      const onSuccess = vi.fn();

      await expect(
        persistSuggestionUpdate(
          {
            sessionId: null,
            startSession: vi.fn().mockResolvedValue("sess-new"),
            saveToSession: vi.fn().mockRejectedValue(error),
          },
          "content",
          `http://example.test/${entityType}`,
          entityType,
          onSuccess,
        ),
      ).rejects.toBe(error);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  },
);

import type { GeneratedEntitySessionWriter } from "@/lib/editor/generatedEntityPersistence";

interface SaveSuggestionUpdateOptions {
  isSessionActive: boolean;
  session: GeneratedEntitySessionWriter;
  content: string;
  entityIri: string;
  entityLabel: string;
  onSaved: () => void;
}

/**
 * Save a structured editor update before publishing any local success state.
 * Session hooks report expected failures as null/false, so callers must treat
 * those values as failed persistence rather than optimistic success.
 */
export async function saveSuggestionUpdate({
  isSessionActive,
  session,
  content,
  entityIri,
  entityLabel,
  onSaved,
}: SaveSuggestionUpdateOptions): Promise<void> {
  if (!isSessionActive) {
    const branch = await session.startSession();
    if (!branch) {
      throw new Error("The suggestion session could not start. Please retry.");
    }
  }

  const saved = await session.saveToSession(content, entityIri, entityLabel);
  if (!saved) {
    throw new Error("The suggested update was not saved. Please retry.");
  }

  onSaved();
}

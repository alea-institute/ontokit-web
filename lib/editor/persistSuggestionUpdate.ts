import type { UseSuggestionSessionReturn } from "@/lib/hooks/useSuggestionSession";

type SuggestionPersistence = Pick<
  UseSuggestionSessionReturn,
  "sessionId" | "startSession" | "saveToSession"
>;

export async function persistSuggestionUpdate(
  suggestionSession: SuggestionPersistence,
  content: string,
  entityIri: string,
  entityLabel: string,
  onSuccess: () => void,
): Promise<void> {
  const sessionId =
    suggestionSession.sessionId ?? (await suggestionSession.startSession());
  await suggestionSession.saveToSession(
    content,
    entityIri,
    entityLabel,
    sessionId,
  );
  onSuccess();
}

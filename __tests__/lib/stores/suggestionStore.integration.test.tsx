import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storeKey, useSuggestionStore } from '@/lib/stores/suggestionStore';
import { SuggestionCard } from '@/components/editor/suggestions/SuggestionCard';
import type { GeneratedSuggestion } from '@/lib/api/generation';

const scope = { projectId: 'project', branch: 'main' };
const entity = 'http://example.org/Parent';
const item: GeneratedSuggestion = { iri: 'http://example.org/Child', label: 'Child', definition: '', confidence: 0.9, suggestion_type: 'children', provenance: 'llm-proposed', validation_errors: [], duplicate_candidates: [], duplicate_verdict: 'pass' };
const key = storeKey(scope, entity, 'children');
beforeEach(() => useSuggestionStore.getState().clearAllSuggestions());
afterEach(() => { cleanup(); useSuggestionStore.getState().clearAllSuggestions(); });

describe('suggestion store empty and stale-action safety', () => {
  it.each(['acceptSuggestion', 'rejectSuggestion', 'editSuggestion'] as const)('handles %s after its target list is cleared', operation => {
    const store = useSuggestionStore.getState();
    store.setSuggestions(scope, entity, 'children', [item]);
    store.clearAllSuggestions();
    if (operation === 'editSuggestion') store.editSuggestion(scope, entity, 'children', 0, 'Changed');
    else store[operation](scope, entity, 'children', 0);
    expect(store.getPendingSuggestions(scope, entity, 'children')).toEqual([]);
    expect(store.getPendingCount(scope)).toBe(0);
  });

  it.each([-1, 10])('does not corrupt neighboring items for missing index %s', index => {
    const store = useSuggestionStore.getState();
    store.setSuggestions(scope, entity, 'children', [item]);
    store.acceptSuggestion(scope, entity, 'children', index);
    store.rejectSuggestion(scope, entity, 'children', index);
    store.editSuggestion(scope, entity, 'children', index, 'Changed');
    expect(store.getPendingSuggestions(scope, entity, 'children')).toEqual([{ suggestion: item, status: 'pending' }]);
  });

  it('does not notify subscribers for a stale or mismatched distinct decision', () => {
    const store = useSuggestionStore.getState();
    store.setSuggestions(scope, entity, 'children', [{ ...item, duplicate_candidates: [{ iri: 'other', label: 'Other', score: 0.99, branch: 'review' }], duplicate_verdict: 'block' }]);
    const before = useSuggestionStore.getState();
    store.removeDuplicateCandidate(scope, entity, 'children', 8, { iri: 'other' });
    expect(useSuggestionStore.getState()).toBe(before);
    store.removeDuplicateCandidate(scope, entity, 'children', 0, { iri: 'other', branch: 'main' });
    expect(useSuggestionStore.getState()).toBe(before);
  });

  it('falls back to an annotation label when no generated value exists', () => {
    const store = useSuggestionStore.getState();
    store.setSuggestions(scope, entity, 'children', [{ ...item, property_iri: 'http://example.org/note', value: undefined }]);
    store.editSuggestion(scope, entity, 'children', 0, 'Changed');
    store.editSuggestion(scope, entity, 'children', 0, item.label);
    expect(useSuggestionStore.getState().suggestions[key][0]).toMatchObject({ editedValue: undefined, suggestion: { provenance: 'llm-proposed' } });
  });

  it('updates the real card after duplicate review and removes it from pending state after acceptance', () => {
    const candidate = { iri: 'http://example.org/Existing', label: 'Existing', score: 0.99 };
    useSuggestionStore.getState().setSuggestions(scope, entity, 'children', [{ ...item, duplicate_candidates: [candidate], duplicate_verdict: 'block' }]);
    function Consumer() {
      const state = useSuggestionStore(); const current = state.suggestions[key]?.[0];
      if (!current || current.status !== 'pending') return <p>No pending suggestions</p>;
      return <SuggestionCard item={current} onAccept={() => state.acceptSuggestion(scope, entity, 'children', 0)} onReject={() => state.rejectSuggestion(scope, entity, 'children', 0)} onEdit={value => state.editSuggestion(scope, entity, 'children', 0, value)} />;
    }
    render(<Consumer />);
    expect(screen.getByRole('button', { name: 'Accept suggestion' }).hasAttribute('disabled')).toBe(true);
    act(() => useSuggestionStore.getState().removeDuplicateCandidate(scope, entity, 'children', 0, candidate));
    expect(screen.getByRole('button', { name: 'Accept suggestion' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Accept suggestion' }));
    expect(screen.getByText('No pending suggestions')).toBeDefined();
    expect(useSuggestionStore.getState().getFirstPendingRef()).toBeNull();
  });
});

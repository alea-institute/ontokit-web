"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ChangedEntity } from "@/lib/hooks/useChangedEntities";

type Entries = ReadonlyMap<string, ChangedEntity>;

function createChangedEntitiesStore(entries: Entries) {
  const listeners = new Map<string, Set<() => void>>();

  return {
    get: (iri: string) => entries.get(iri),
    subscribe(iri: string, notify: () => void) {
      const subscribers = listeners.get(iri) ?? new Set();
      subscribers.add(notify);
      listeners.set(iri, subscribers);
      return () => {
        subscribers.delete(notify);
        if (subscribers.size === 0) listeners.delete(iri);
      };
    },
    replace(next: Entries) {
      const previous = entries;
      entries = next;
      for (const [iri, subscribers] of listeners) {
        if (previous.get(iri) !== next.get(iri)) {
          for (const notify of subscribers) notify();
        }
      }
    },
  };
}

const ChangedEntitiesContext = createContext<ReturnType<typeof createChangedEntitiesStore> | null>(null);
const noServerEntry = () => undefined;
const noSubscription = () => {};

export function ChangedEntitiesProvider({ entries, children }: { entries: Entries; children: ReactNode }) {
  const [store] = useState(() => createChangedEntitiesStore(entries));
  useLayoutEffect(() => store.replace(entries), [store, entries]);

  return <ChangedEntitiesContext.Provider value={store}>{children}</ChangedEntitiesContext.Provider>;
}

export function useChangedEntity(iri: string) {
  const store = useContext(ChangedEntitiesContext);
  const subscribe = useCallback((notify: () => void) => store?.subscribe(iri, notify) ?? noSubscription, [store, iri]);
  const getSnapshot = useCallback(() => store?.get(iri), [store, iri]);

  return useSyncExternalStore(subscribe, getSnapshot, noServerEntry);
}

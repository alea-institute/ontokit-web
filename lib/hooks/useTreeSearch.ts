"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";

interface UseTreeSearchOptions {
  projectId: string;
  accessToken?: string;
  branch?: string;
  onSearchSelect: (iri: string) => void;
}

interface UseTreeSearchReturn {
  showSearch: boolean;
  searchQuery: string;
  searchResults: EntitySearchResult[] | null;
  isSearching: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  toggleSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  handleSearchSelect: (iri: string) => void;
}

export function useTreeSearch({
  projectId,
  accessToken,
  branch,
  onSearchSelect,
}: UseTreeSearchOptions): UseTreeSearchReturn {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setSearchQuery("");
        setSearchResults(null);
      }
      return !prev;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  const handleSearchSelect = useCallback(
    (iri: string) => {
      onSearchSelect(iri);
      closeSearch();
    },
    [onSearchSelect, closeSearch],
  );

  // Debounced search
  useEffect(() => {
    if (!showSearch) return;
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await projectOntologyApi.searchEntities(
          projectId,
          searchQuery.trim(),
          accessToken,
          branch,
        );
        setSearchResults(response.results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, projectId, accessToken, branch]);

  return {
    showSearch,
    searchQuery,
    searchResults,
    isSearching,
    searchInputRef,
    toggleSearch,
    closeSearch,
    setSearchQuery,
    handleSearchSelect,
  };
}

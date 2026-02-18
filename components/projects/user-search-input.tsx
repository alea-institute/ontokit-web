"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, Check } from "lucide-react";
import {
  userSettingsApi,
  type UserSearchResult,
} from "@/lib/api/userSettings";
import { cn } from "@/lib/utils";

interface UserSearchInputProps {
  value: string;
  onSelect: (userId: string) => void;
  onClear: () => void;
  token: string;
  disabled?: boolean;
}

export function UserSearchInput({
  value,
  onSelect,
  onClear,
  token,
  disabled = false,
}: UserSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await userSettingsApi.searchUsers(
          token,
          searchQuery,
          10
        );
        setResults(response.items);
        setIsOpen(response.items.length > 0);
        setHighlightIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    // Clear selection if user modifies input
    if (selectedUser) {
      setSelectedUser(null);
      onClear();
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 300);
  };

  const handleSelect = (user: UserSearchResult) => {
    setSelectedUser(user);
    setQuery(user.display_name || user.username);
    setIsOpen(false);
    setResults([]);
    onSelect(user.id);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedUser(null);
    setResults([]);
    setIsOpen(false);
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          handleSelect(results[highlightIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isSelected = !!value && !!selectedUser;

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <Search className="h-4 w-4 text-slate-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by name, username, or email..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 && !isSelected) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          className={cn(
            "w-full rounded-md border py-2 pl-9 pr-8 text-sm",
            "focus:outline-none focus:ring-1",
            isSelected
              ? "border-green-500 bg-green-50 focus:border-green-500 focus:ring-green-500 dark:border-green-600 dark:bg-green-900/20"
              : "border-slate-300 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800",
            "dark:text-slate-100"
          )}
        />
        {(query || isSelected) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected user badge */}
      {isSelected && selectedUser && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs text-green-700 dark:text-green-400">
            {selectedUser.display_name || selectedUser.username}
            {selectedUser.email && (
              <span className="ml-1 text-green-600/70 dark:text-green-500">
                ({selectedUser.email})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {results.map((user, index) => (
            <li
              key={user.id}
              role="option"
              aria-selected={highlightIndex === index}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(user);
              }}
              onMouseEnter={() => setHighlightIndex(index)}
              className={cn(
                "cursor-pointer px-3 py-2",
                highlightIndex === index
                  ? "bg-primary-50 dark:bg-primary-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {user.display_name || user.username}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>@{user.username}</span>
                {user.email && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">
                      &middot;
                    </span>
                    <span>{user.email}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

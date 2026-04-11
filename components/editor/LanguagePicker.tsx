"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { ChevronDown } from "lucide-react";
import { langToFlag } from "@/lib/utils";
import {
  FREQUENT_LANGUAGES,
  ALL_LANGUAGES,
  findLanguageByCode,
  type LanguageOption,
} from "@/lib/i18n/languageCodes";

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

/** Set of codes that appear in the "Frequently used" group */
const FREQUENT_CODES = new Set(FREQUENT_LANGUAGES.map((l) => l.code));

/** Languages that only appear in the "All languages" group */
const OTHER_LANGUAGES: LanguageOption[] = ALL_LANGUAGES.filter(
  (l) => !FREQUENT_CODES.has(l.code)
);

/** Strip diacritics for accent-insensitive search (e.g. "francais" matches "Français") */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Compact searchable combobox for selecting a BCP 47 language tag.
 *
 * Uses `cmdk` for keyboard-accessible filtering. The trigger button shows
 * the country flag emoji + language code, matching the width of the previous
 * plain `<input>` it replaces.
 */
export function LanguagePicker({ value, onChange, disabled }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listboxId, setListboxId] = useState<string | undefined>();

  // Capture the cmdk-generated listbox id via ref callback
  const listRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const listbox = node.querySelector('[role="listbox"]');
      setListboxId(listbox?.id || undefined);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const flag = langToFlag(value);
  const langInfo = findLanguageByCode(value);
  const displayLabel = langInfo ? langInfo.code : value || "lang";

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="Language tag"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        title={langInfo ? `${langInfo.name} (${langInfo.nativeName})` : value || "Select language"}
        className="flex w-14 items-center justify-center gap-0.5 rounded-md border border-slate-300 bg-white px-1 py-1.5 text-xs text-slate-700 hover:border-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
      >
        {flag && <span className="text-sm leading-none">{flag}</span>}
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div ref={listRefCallback} className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
          <Command
            filter={(value, search) => {
              const lang = ALL_LANGUAGES.find((l) => l.code === value);
              if (!lang) return 0;
              const q = stripDiacritics(search.toLowerCase());
              if (stripDiacritics(lang.code.toLowerCase()).includes(q)) return 1;
              if (stripDiacritics(lang.name.toLowerCase()).includes(q)) return 1;
              if (stripDiacritics(lang.nativeName.toLowerCase()).includes(q)) return 1;
              return 0;
            }}
          >
            <div className="border-b border-slate-200 px-2 py-1.5 dark:border-slate-600">
              <Command.Input
                placeholder="Search languages..."
                autoFocus
                className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
            <Command.List className="max-h-60 overflow-y-auto py-1">
              <Command.Empty className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                No matching languages
              </Command.Empty>

              <Command.Group
                heading="Frequently used"
                className="[&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-0.5 [&>[cmdk-group-heading]]:text-[9px] [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-slate-400 dark:[&>[cmdk-group-heading]]:text-slate-500"
              >
                {FREQUENT_LANGUAGES.map((lang) => (
                  <LanguageItem
                    key={lang.code}
                    lang={lang}
                    selected={lang.code === value}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>

              <Command.Group
                heading="All languages"
                className="[&>[cmdk-group-heading]]:px-2 [&>[cmdk-group-heading]]:py-0.5 [&>[cmdk-group-heading]]:text-[9px] [&>[cmdk-group-heading]]:font-semibold [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wider [&>[cmdk-group-heading]]:text-slate-400 dark:[&>[cmdk-group-heading]]:text-slate-500"
              >
                {OTHER_LANGUAGES.map((lang) => (
                  <LanguageItem
                    key={lang.code}
                    lang={lang}
                    selected={lang.code === value}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}

function LanguageItem({
  lang,
  selected,
  onSelect,
}: {
  lang: LanguageOption;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  const flag = langToFlag(lang.code);

  return (
    <Command.Item
      value={lang.code}
      onSelect={() => onSelect(lang.code)}
      className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs aria-selected:bg-slate-100 dark:aria-selected:bg-slate-600"
    >
      <span className="inline-flex w-5 shrink-0 items-center justify-center text-sm leading-none">
        {flag}
      </span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{lang.name}</span>
      {lang.nativeName !== lang.name && (
        <span className="text-slate-400 dark:text-slate-500">{lang.nativeName}</span>
      )}
      <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{lang.code}</span>
      {selected && (
        <span className="text-primary-500" aria-label="Selected">
          &#10003;
        </span>
      )}
    </Command.Item>
  );
}

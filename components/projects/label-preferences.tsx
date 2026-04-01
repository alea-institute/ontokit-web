"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Common label properties
const LABEL_PROPERTIES = [
  { value: "rdfs:label", label: "rdfs:label" },
  { value: "skos:prefLabel", label: "skos:prefLabel" },
  { value: "skos:altLabel", label: "skos:altLabel" },
  { value: "dcterms:title", label: "dcterms:title" },
  { value: "dc:title", label: "dc:title" },
];

// Common languages
const LANGUAGES = [
  { value: "", label: "Any language" },
  { value: "en", label: "English (en)" },
  { value: "it", label: "Italian (it)" },
  { value: "es", label: "Spanish (es)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "la", label: "Latin (la)" },
];

interface LabelPreferencesProps {
  preferences: string[];
  onChange: (preferences: string[]) => void;
  disabled?: boolean;
}

export function LabelPreferences({
  preferences,
  onChange,
  disabled = false,
}: LabelPreferencesProps) {
  const [newProperty, setNewProperty] = useState("rdfs:label");
  const [newLanguage, setNewLanguage] = useState("");

  const handleAdd = () => {
    const pref = newLanguage ? `${newProperty}@${newLanguage}` : newProperty;
    if (!preferences.includes(pref)) {
      onChange([...preferences, pref]);
    }
  };

  const handleRemove = (index: number) => {
    onChange(preferences.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newPrefs = [...preferences];
    [newPrefs[index - 1], newPrefs[index]] = [newPrefs[index], newPrefs[index - 1]];
    onChange(newPrefs);
  };

  const handleMoveDown = (index: number) => {
    if (index === preferences.length - 1) return;
    const newPrefs = [...preferences];
    [newPrefs[index], newPrefs[index + 1]] = [newPrefs[index + 1], newPrefs[index]];
    onChange(newPrefs);
  };

  const parsePreference = (pref: string) => {
    const [prop, lang] = pref.includes("@") ? pref.split("@") : [pref, null];
    return { prop, lang };
  };

  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p>
            Label preferences determine how class names are displayed in the ontology viewer.
            The system tries each preference in order until it finds a matching label.
          </p>
          <p className="mt-1">
            For example, <code className="rounded-xs bg-blue-100 px-1 dark:bg-blue-800">rdfs:label@en</code> will
            look for English labels first.
          </p>
        </div>
      </div>

      {/* Current preferences list */}
      {preferences.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Current preferences (in priority order)
          </label>
          <ul className="space-y-2">
            {preferences.map((pref, index) => {
              const { prop, lang } = parsePreference(pref);
              return (
                <li
                  key={index}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-700"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={disabled || index === 0}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-300"
                      title="Move up"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={disabled || index === preferences.length - 1}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-300"
                      title="Move down"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                  <span className="flex-1 font-mono text-sm text-slate-700 dark:text-slate-300">
                    <span className="text-primary-600 dark:text-primary-400">{prop}</span>
                    {lang && (
                      <span className="text-slate-500">
                        @<span className="text-amber-600 dark:text-amber-400">{lang}</span>
                      </span>
                    )}
                  </span>
                  <span className="rounded-xs bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-600 dark:text-slate-400">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {preferences.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No preferences configured. Using defaults: rdfs:label@en, rdfs:label, skos:prefLabel@en, skos:prefLabel
        </p>
      )}

      {/* Add new preference */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Add preference
        </label>
        <div className="flex gap-2">
          <select
            value={newProperty}
            onChange={(e) => setNewProperty(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-sm",
              "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
              "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            )}
          >
            {LABEL_PROPERTIES.map((prop) => (
              <option key={prop.value} value={prop.value}>
                {prop.label}
              </option>
            ))}
          </select>
          <select
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            disabled={disabled}
            className={cn(
              "w-40 rounded-md border px-3 py-2 text-sm",
              "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
              "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            )}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

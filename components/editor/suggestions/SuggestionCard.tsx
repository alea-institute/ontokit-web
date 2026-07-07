"use client";

import { useState, useCallback } from "react";
import { Sparkles, Check, X, Pencil, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredSuggestion } from "@/lib/stores/suggestionStore";

export interface SuggestionCardProps {
  item: StoredSuggestion;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (editedValue: string) => void;
  disabled?: boolean;
}

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.9) {
    return "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
  }
  if (confidence >= 0.7) {
    return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
  }
  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
}

export function SuggestionCard({
  item,
  onAccept,
  onReject,
  onEdit,
  disabled,
}: SuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const suggestion = item.suggestion;
  const isBlocked = suggestion.duplicate_verdict === "block";
  const isWarned = suggestion.duplicate_verdict === "warn";
  const confidence = suggestion.confidence;
  const isUserEdited = suggestion.provenance === "user-edited-from-llm";

  // Provenance attribution surfaced on the sparkle icon (full badge UI ships
  // with the reviewer tools; here every suggestion still declares its origin).
  // Both the model AND the prompt-template are surfaced so every suggestion
  // carries its full generation provenance (H-3).
  const modelLabel = suggestion.model
    ? ` by ${suggestion.model}${suggestion.prompt_template ? ` (${suggestion.prompt_template})` : ""}`
    : suggestion.prompt_template
      ? ` (${suggestion.prompt_template})`
      : "";
  const provenanceLabel = isUserEdited
    ? `AI-suggested${modelLabel}, edited by you`
    : `AI-suggested${modelLabel}`;

  const validationErrors = suggestion.validation_errors ?? [];

  // Display the annotation value when property_iri exists, otherwise the label
  const displayText = suggestion.property_iri
    ? (suggestion.value ?? suggestion.label)
    : suggestion.label;

  const handleEditClick = useCallback(() => {
    setEditValue(item.editedValue ?? displayText);
    setIsEditing(true);
  }, [item.editedValue, displayText]);

  const handleAcceptEdit = useCallback(() => {
    // M-5: the edit flow (onEdit) bypasses the plain Accept button's
    // `disabled || isBlocked` guard. If this suggestion is a blocked duplicate
    // and the text was NOT changed, committing would silently accept the
    // duplicate — so refuse. If the text changed, the duplicate was resolved
    // by editing and we allow the commit (the store re-flags provenance).
    if (isBlocked && editValue === displayText) {
      setIsEditing(false);
      return;
    }
    onEdit(editValue);
    setIsEditing(false);
  }, [editValue, onEdit, isBlocked, displayText]);

  const handleDiscardEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
  }, []);

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2",
        "dark:border-slate-700 dark:bg-slate-800/50",
        "hover:border-solid hover:border-slate-300 hover:shadow-sm",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-inset",
        "transition-colors duration-200"
      )}
    >
      {/* Provenance icon -- every suggestion declares its origin */}
      <span className="shrink-0 mt-0.5" title={provenanceLabel}>
        <Sparkles className="h-3 w-3 text-amber-500" aria-hidden="true" />
        <span className="sr-only">{provenanceLabel}</span>
      </span>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAcceptEdit();
              if (e.key === "Escape") handleDiscardEdit();
            }}
          />
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {item.editedValue ?? displayText}
            {isUserEdited && (
              <span className="ml-1.5 text-xs italic text-slate-400 dark:text-slate-500">
                edited
              </span>
            )}
          </span>
        )}

        {/* Duplicate block warning */}
        {isBlocked && !isEditing && (
          <div className="mt-1">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Likely duplicate
            </span>
            {suggestion.duplicate_candidates.slice(0, 3).map((c) => (
              <div key={c.iri} className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {c.label} ({Math.round(c.score * 100)}%)
              </div>
            ))}
          </div>
        )}

        {/* Validation errors (L-2) — malformed suggestions must not read as clean */}
        {validationErrors.length > 0 && !isEditing && (
          <ul className="mt-1 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li
                key={`${err.field}-${err.code}-${i}`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {err.field ? `${err.field}: ` : ""}{err.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Duplicate warn icon (M-4 — announced to screen readers) */}
      {isWarned && !isEditing && (
        <span className="shrink-0 mt-0.5" title="Similar entity may already exist">
          <AlertTriangle
            className="h-3.5 w-3.5 text-amber-500"
            aria-label="Similar entity may already exist"
            role="img"
          />
          <span className="sr-only">Similar entity may already exist</span>
        </span>
      )}

      {/* Confidence badge (L-3 — accessible name) */}
      {confidence !== null && confidence !== undefined && !isEditing && (
        <span
          aria-label={`confidence ${Math.round(confidence * 100)}%`}
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium shrink-0",
            confidenceBadgeClass(confidence)
          )}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleAcceptEdit}
              className="rounded-sm px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={handleDiscardEdit}
              className="rounded-sm px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Discard edit
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={disabled || isBlocked}
              aria-label="Accept suggestion"
              className="rounded-sm p-1 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onReject}
              aria-label="Reject suggestion"
              className="rounded-sm p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleEditClick}
              aria-label="Edit suggestion before accepting"
              className="rounded-sm p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

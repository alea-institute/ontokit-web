"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type EntityType,
  type IriSuffixPattern,
  labelToLocalName,
  uuidToBase62,
} from "@/lib/ontology/iriGeneration";

// ── Types ────────────────────────────────────────────────────────────

export interface NewEntityInfo {
  iri: string;
  label: string;
  entityType: EntityType;
  parentIri?: string;
}

interface AddEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (entity: NewEntityInfo) => void;
  iriPattern: IriSuffixPattern;
  nextNumeric?: number;
  ontologyNamespace: string;
  parentIri?: string;
  /** Human-readable label for the parent entity (shown in dialog description) */
  parentLabel?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "class", label: "Class" },
  { value: "objectProperty", label: "Object Property" },
  { value: "dataProperty", label: "Data Property" },
  { value: "annotationProperty", label: "Annotation Property" },
  { value: "individual", label: "Individual" },
];

// ── Component ────────────────────────────────────────────────────────

export function AddEntityDialog({
  open,
  onOpenChange,
  onConfirm,
  iriPattern,
  nextNumeric,
  ontologyNamespace,
  parentIri,
  parentLabel,
}: AddEntityDialogProps) {
  const [label, setLabel] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("class");
  const [iri, setIri] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const iriManuallyEdited = useRef(false);

  // Generate a stable UUID IRI once when the dialog opens
  const stableUuidIriRef = useRef("");

  // Generate IRI based on current state
  const generateIri = useCallback(
    (currentLabel: string) => {
      switch (iriPattern) {
        case "named":
          if (currentLabel.trim()) {
            return ontologyNamespace + labelToLocalName(currentLabel);
          }
          return ontologyNamespace + "...";
        case "numeric":
          return ontologyNamespace + String(nextNumeric ?? 1);
        case "uuid":
        default:
          return stableUuidIriRef.current;
      }
    },
    [iriPattern, nextNumeric, ontologyNamespace],
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setLabel("");
      setEntityType(parentIri ? "class" : "class");
      setShowAdvanced(false);
      iriManuallyEdited.current = false;

      // Generate a fresh UUID IRI for this dialog session
      stableUuidIriRef.current = ontologyNamespace + uuidToBase62();

      // Set initial IRI
      const initialIri = iriPattern === "uuid"
        ? stableUuidIriRef.current
        : iriPattern === "numeric"
          ? ontologyNamespace + String(nextNumeric ?? 1)
          : ontologyNamespace + "...";
      setIri(initialIri);

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, iriPattern, nextNumeric, ontologyNamespace, parentIri]);

  // Update IRI reactively when label changes (named pattern only)
  useEffect(() => {
    if (!open) return;
    if (iriPattern === "named" && !iriManuallyEdited.current) {
      setIri(generateIri(label));
    }
  }, [label, open, iriPattern, generateIri]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedIri = iri.trim();
    if (!trimmedLabel || !trimmedIri) return;

    onConfirm({
      iri: trimmedIri,
      label: trimmedLabel,
      entityType,
      parentIri,
    });
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const parentDisplayName = parentLabel || (parentIri
    ? parentIri.includes("#")
      ? parentIri.split("#").pop()
      : parentIri.split("/").pop()
    : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Entity
            </DialogTitle>
            <DialogDescription asChild>
              <p>
                {parentIri ? (
                  <>
                    Create a new subclass of{" "}
                    <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {parentDisplayName}
                    </span>
                  </>
                ) : (
                  "Create a new entity in this ontology"
                )}
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-4">
            {/* Label input */}
            <div>
              <label
                htmlFor="entity-label"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Label
              </label>
              <input
                ref={inputRef}
                id="entity-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Privileged Altar"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                autoComplete="off"
              />
            </div>

            {/* Entity type select */}
            <div>
              <label
                htmlFor="entity-type"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Type
              </label>
              <select
                id="entity-type"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityType)}
                disabled={!!parentIri}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {parentIri && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Type is locked to Class when creating a subclass.
                </p>
              )}
            </div>

            {/* Advanced: IRI */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showAdvanced ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Advanced
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <label
                    htmlFor="entity-iri"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    IRI
                  </label>
                  <input
                    id="entity-iri"
                    type="text"
                    value={iri}
                    onChange={(e) => {
                      iriManuallyEdited.current = true;
                      setIri(e.target.value);
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {iriPattern === "uuid" && "Auto-generated UUID-based IRI"}
                    {iriPattern === "numeric" && `Sequential numeric IRI (next: ${nextNumeric ?? 1})`}
                    {iriPattern === "named" && "Derived from label"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

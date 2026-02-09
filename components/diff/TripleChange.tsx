"use client";

import { type TripleChange as TripleChangeType } from "@/lib/api/revisions";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

interface TripleChangeProps {
  change: TripleChangeType;
  className?: string;
}

export function TripleChange({ change, className }: TripleChangeProps) {
  const isAdded = change.change_type === "added";

  // Shorten IRIs for display
  const shortenIRI = (iri: string) => {
    // Extract the local part after # or last /
    const hashIndex = iri.lastIndexOf("#");
    const slashIndex = iri.lastIndexOf("/");
    const splitIndex = Math.max(hashIndex, slashIndex);

    if (splitIndex > 0) {
      const prefix = iri.substring(0, splitIndex + 1);
      const local = iri.substring(splitIndex + 1);

      // Try to guess a prefix
      if (prefix.includes("rdf-syntax-ns")) {
        return `rdf:${local}`;
      } else if (prefix.includes("rdf-schema")) {
        return `rdfs:${local}`;
      } else if (prefix.includes("www.w3.org/2002/07/owl")) {
        return `owl:${local}`;
      } else if (prefix.includes("XMLSchema")) {
        return `xsd:${local}`;
      } else if (prefix.includes("purl.org/dc/terms")) {
        return `dcterms:${local}`;
      } else if (prefix.includes("purl.org/dc/elements")) {
        return `dc:${local}`;
      } else if (prefix.includes("skos")) {
        return `skos:${local}`;
      }

      // If IRI is too long, show abbreviated version
      if (iri.length > 60) {
        return `...${local}`;
      }
    }

    return iri;
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 font-mono text-sm",
        isAdded
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20",
        className
      )}
    >
      {/* Change indicator */}
      <div
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
          isAdded
            ? "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300"
            : "bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300"
        )}
      >
        {isAdded ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      </div>

      {/* Triple */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-slate-500">&lt;</span>
          <span
            className="truncate text-blue-600 dark:text-blue-400"
            title={change.subject}
          >
            {shortenIRI(change.subject)}
          </span>
          <span className="text-slate-500">&gt;</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 pl-4">
          <span
            className="truncate text-purple-600 dark:text-purple-400"
            title={change.predicate}
          >
            {shortenIRI(change.predicate)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 pl-8">
          {change.object.startsWith("http://") ||
          change.object.startsWith("https://") ? (
            <>
              <span className="text-slate-500">&lt;</span>
              <span
                className="truncate text-green-600 dark:text-green-400"
                title={change.object}
              >
                {shortenIRI(change.object)}
              </span>
              <span className="text-slate-500">&gt;</span>
            </>
          ) : (
            <span
              className="text-amber-600 dark:text-amber-400"
              title={change.object}
            >
              "{change.object}"
            </span>
          )}
          <span className="text-slate-500">.</span>
        </div>
      </div>
    </div>
  );
}

interface SemanticDiffProps {
  added: TripleChangeType[];
  removed: TripleChangeType[];
  className?: string;
}

export function SemanticDiff({ added, removed, className }: SemanticDiffProps) {
  const totalChanges = added.length + removed.length;

  if (totalChanges === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
        No semantic changes detected
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        {added.length > 0 && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Plus className="h-4 w-4" />
            {added.length} added
          </span>
        )}
        {removed.length > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Minus className="h-4 w-4" />
            {removed.length} removed
          </span>
        )}
      </div>

      {/* Removed triples */}
      {removed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-400">
            Removed
          </h4>
          <div className="space-y-1">
            {removed.map((triple, index) => (
              <TripleChange key={`removed-${index}`} change={triple} />
            ))}
          </div>
        </div>
      )}

      {/* Added triples */}
      {added.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-700 dark:text-green-400">
            Added
          </h4>
          <div className="space-y-1">
            {added.map((triple, index) => (
              <TripleChange key={`added-${index}`} change={triple} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

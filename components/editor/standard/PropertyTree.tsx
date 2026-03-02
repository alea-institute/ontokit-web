"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";

interface PropertyTreeProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  selectedIri: string | null;
  onSelect: (iri: string) => void;
}

interface PropertyGroup {
  label: string;
  type: string;
  items: EntitySearchResult[];
  isExpanded: boolean;
}

export function PropertyTree({
  projectId,
  accessToken,
  branch,
  selectedIri,
  onSelect,
}: PropertyTreeProps) {
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchProperties = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Search for all properties with a broad query
        const response = await projectOntologyApi.searchEntities(
          projectId,
          "*",
          accessToken,
          branch,
          "property",
        );

        if (cancelled) return;

        // Group properties by likely type based on IRI patterns
        const objectProps: EntitySearchResult[] = [];
        const dataProps: EntitySearchResult[] = [];
        const annotationProps: EntitySearchResult[] = [];

        for (const prop of response.results) {
          const iri = prop.iri.toLowerCase();
          if (
            iri.includes("objectproperty") ||
            iri.includes("object-property")
          ) {
            objectProps.push(prop);
          } else if (
            iri.includes("datatypeproperty") ||
            iri.includes("datatype-property") ||
            iri.includes("dataproperty")
          ) {
            dataProps.push(prop);
          } else if (
            iri.includes("annotationproperty") ||
            iri.includes("annotation-property") ||
            iri.includes("http://www.w3.org/2000/01/rdf-schema#") ||
            iri.includes("http://www.w3.org/2004/02/skos/core#") ||
            iri.includes("http://purl.org/dc/")
          ) {
            annotationProps.push(prop);
          } else {
            // Default to object property group
            objectProps.push(prop);
          }
        }

        const newGroups: PropertyGroup[] = [];
        if (objectProps.length > 0) {
          newGroups.push({ label: "Object Properties", type: "object", items: objectProps, isExpanded: true });
        }
        if (dataProps.length > 0) {
          newGroups.push({ label: "Data Properties", type: "data", items: dataProps, isExpanded: true });
        }
        if (annotationProps.length > 0) {
          newGroups.push({ label: "Annotation Properties", type: "annotation", items: annotationProps, isExpanded: true });
        }

        // If all ended up in one bucket with no type hints, show flat
        if (newGroups.length === 0 && response.results.length > 0) {
          newGroups.push({ label: "Properties", type: "all", items: response.results, isExpanded: true });
        }

        setGroups(newGroups);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load properties");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchProperties();
    return () => { cancelled = true; };
  }, [projectId, accessToken, branch]);

  const toggleGroup = (index: number) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, isExpanded: !g.isExpanded } : g))
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No properties found in this ontology
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {groups.map((group, gi) => (
        <div key={group.type}>
          <button
            onClick={() => toggleGroup(gi)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50"
          >
            {group.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {group.label}
            <span className="ml-auto font-normal text-slate-400">{group.items.length}</span>
          </button>
          {group.isExpanded && (
            <div>
              {group.items.map((prop) => (
                <button
                  key={prop.iri}
                  onClick={() => onSelect(prop.iri)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm",
                    selectedIri === prop.iri
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400">
                    <span className="text-[9px] font-bold">P</span>
                  </span>
                  <span className="truncate">
                    {prop.label || getLocalName(prop.iri)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

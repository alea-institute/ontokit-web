"use client";

import { useState, useEffect, useMemo } from "react";
import { getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import { EntityTree } from "@/components/editor/shared/EntityTree";
import type { EntityTreeNode } from "@/lib/ontology/types";

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
            iri.startsWith("http://www.w3.org/2000/01/rdf-schema#") ||
            iri.startsWith("http://www.w3.org/2004/02/skos/core#") ||
            iri.startsWith("http://purl.org/dc/")
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

  // Convert PropertyGroup[] to EntityTreeNode[]
  const entityNodes = useMemo((): EntityTreeNode[] => {
    return groups.map((group) => ({
      iri: `__group__${group.type}`,
      label: group.label,
      children: group.items.map((prop) => ({
        iri: prop.iri,
        label: prop.label || getLocalName(prop.iri),
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
        entityType: "property" as const,
        deprecated: prop.deprecated,
      })),
      isExpanded: group.isExpanded,
      isLoading: false,
      hasChildren: group.items.length > 0,
      isGroupHeader: true,
    }));
  }, [groups]);

  const handleExpand = (iri: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        `__group__${g.type}` === iri ? { ...g, isExpanded: true } : g,
      ),
    );
  };

  const handleCollapse = (iri: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        `__group__${g.type}` === iri ? { ...g, isExpanded: false } : g,
      ),
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
    <EntityTree
      nodes={entityNodes}
      selectedIri={selectedIri}
      onSelect={onSelect}
      onExpand={handleExpand}
      onCollapse={handleCollapse}
    />
  );
}

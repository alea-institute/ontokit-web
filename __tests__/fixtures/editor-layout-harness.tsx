import React from "react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastProvider } from "@/lib/context/ToastContext";
import type { StandardEditorLayoutProps } from "@/components/editor/standard/StandardEditorLayout";

export const layoutNs = "https://example.org/layout#";
export const layoutSource = `@prefix : <${layoutNs}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:first a owl:ObjectProperty ; rdfs:label "First relation"@en .
:second a owl:ObjectProperty ; rdfs:label "Second relation"@en .
:alice a owl:NamedIndividual ; rdfs:label "Alice"@en .`;
export function layoutProps(overrides: Partial<StandardEditorLayoutProps> = {}): StandardEditorLayoutProps {
  return {
    projectId: "layout-project", accessToken: "test-token", activeBranch: "work", canEdit: false,
    nodes: [], isTreeLoading: false, treeError: null, selectedIri: null,
    selectNode: vi.fn(), expandNode: vi.fn(), collapseNode: vi.fn(),
    expandOneLevel: vi.fn().mockResolvedValue(undefined), expandAllFully: vi.fn().mockResolvedValue(undefined),
    collapseAll: vi.fn(), collapseOneLevel: vi.fn(), hasExpandableNodes: false, hasExpandedNodes: false,
    isExpandingAll: false, navigateToNode: vi.fn().mockResolvedValue(undefined), onAddEntity: vi.fn(),
    selectedNodeFallback: null, sourceContent: layoutSource, ...overrides,
  };
}
export function LayoutProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><TooltipProvider><ToastProvider>{children}</ToastProvider></TooltipProvider></QueryClientProvider>;
}
export function layoutFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname.includes("/translation/")) {
      const body = url.pathname.endsWith("/config") ? { language_tags: [] } : url.pathname.endsWith("/state") ? { items: [] } : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (!url.pathname.endsWith("/ontology/search")) throw new Error(`Unexpected layout request: ${url.pathname}`);
    const individual = url.searchParams.get("entity_types") === "individual";
    const results = individual
      ? [{ iri: layoutNs + "alice", label: "Alice", entity_type: "individual" }]
      : ["first", "second"].map((id, i) => ({ iri: layoutNs + id, label: i ? "Second relation" : "First relation", entity_type: "property", property_kind: "object" }));
    return new Response(JSON.stringify({ results, total: results.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

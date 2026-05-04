import { describe, expect, it, vi } from "vitest";
import {
  detectLanguageFromExtension,
  getLanguageMimeType,
  registerRdfLanguages,
  RDF_LANGUAGE_IDS,
} from "@/lib/editor/languages";

// Mock the registration functions to avoid needing full monaco
vi.mock("@/lib/editor/languages/turtle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/editor/languages/turtle")>();
  return {
    ...actual,
    registerTurtleLanguage: vi.fn(),
  };
});

vi.mock("@/lib/editor/languages/sparql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/editor/languages/sparql")>();
  return {
    ...actual,
    registerSparqlLanguage: vi.fn(),
  };
});

import { registerTurtleLanguage } from "@/lib/editor/languages/turtle";
import { registerSparqlLanguage } from "@/lib/editor/languages/sparql";

describe("detectLanguageFromExtension", () => {
  it("detects Turtle files", () => {
    expect(detectLanguageFromExtension("ontology.ttl")).toBe("turtle");
    expect(detectLanguageFromExtension("file.turtle")).toBe("turtle");
    expect(detectLanguageFromExtension("file.n3")).toBe("turtle");
  });

  it("detects SPARQL files", () => {
    expect(detectLanguageFromExtension("query.rq")).toBe("sparql");
    expect(detectLanguageFromExtension("query.sparql")).toBe("sparql");
    expect(detectLanguageFromExtension("query.sq")).toBe("sparql");
  });

  it("detects XML-based RDF files", () => {
    expect(detectLanguageFromExtension("ontology.owl")).toBe("xml");
    expect(detectLanguageFromExtension("data.rdf")).toBe("xml");
    expect(detectLanguageFromExtension("file.xml")).toBe("xml");
  });

  it("detects JSON-LD files", () => {
    expect(detectLanguageFromExtension("data.jsonld")).toBe("json");
    expect(detectLanguageFromExtension("file.json")).toBe("json");
  });

  it("returns null for unknown extensions", () => {
    expect(detectLanguageFromExtension("file.txt")).toBeNull();
    expect(detectLanguageFromExtension("file.py")).toBeNull();
    expect(detectLanguageFromExtension("file.css")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectLanguageFromExtension("FILE.TTL")).toBe("turtle");
    expect(detectLanguageFromExtension("QUERY.RQ")).toBe("sparql");
  });
});

describe("getLanguageMimeType", () => {
  it("returns text/turtle for turtle", () => {
    expect(getLanguageMimeType("turtle")).toBe("text/turtle");
  });

  it("returns application/sparql-query for sparql", () => {
    expect(getLanguageMimeType("sparql")).toBe("application/sparql-query");
  });

  it("returns text/plain for unknown languages", () => {
    expect(getLanguageMimeType("python")).toBe("text/plain");
    expect(getLanguageMimeType("")).toBe("text/plain");
  });
});

describe("RDF_LANGUAGE_IDS", () => {
  it("has turtle and sparql entries", () => {
    expect(RDF_LANGUAGE_IDS.turtle).toBe("turtle");
    expect(RDF_LANGUAGE_IDS.sparql).toBe("sparql");
  });
});

describe("registerRdfLanguages", () => {
  it("calls both turtle and sparql registration", () => {
    const mockMonaco = {} as typeof import("monaco-editor");

    registerRdfLanguages(mockMonaco);

    expect(registerTurtleLanguage).toHaveBeenCalledWith(mockMonaco);
    expect(registerSparqlLanguage).toHaveBeenCalledWith(mockMonaco);
  });
});

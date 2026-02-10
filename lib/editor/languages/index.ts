/**
 * RDF Language Support for Monaco Editor
 *
 * This module provides syntax highlighting, tokenization, and auto-completion
 * for RDF-related languages including Turtle and SPARQL.
 *
 * Adapted from:
 * - stardog-union/stardog-vsc (TextMate grammars)
 * - dzl-dm/skos-ttl-editor (validation patterns)
 *
 * Usage:
 * ```typescript
 * import { registerRdfLanguages } from '@/lib/editor/languages';
 * import * as monaco from 'monaco-editor';
 *
 * // Register all RDF languages
 * registerRdfLanguages(monaco);
 * ```
 */

export * from './turtle';
export * from './sparql';

import { registerTurtleLanguage, TURTLE_LANGUAGE_ID } from './turtle';
import { registerSparqlLanguage, SPARQL_LANGUAGE_ID } from './sparql';

/**
 * Register all RDF-related languages with Monaco editor
 */
export function registerRdfLanguages(monaco: typeof import('monaco-editor')) {
  registerTurtleLanguage(monaco);
  registerSparqlLanguage(monaco);
}

/**
 * Language IDs for use with Monaco editor
 */
export const RDF_LANGUAGE_IDS = {
  turtle: TURTLE_LANGUAGE_ID,
  sparql: SPARQL_LANGUAGE_ID,
} as const;

/**
 * Detect language from file extension
 */
export function detectLanguageFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'ttl':
    case 'turtle':
    case 'n3':
      return TURTLE_LANGUAGE_ID;
    case 'rq':
    case 'sparql':
    case 'sq':
      return SPARQL_LANGUAGE_ID;
    case 'owl':
    case 'rdf':
    case 'xml':
      return 'xml'; // Monaco has built-in XML support
    case 'jsonld':
    case 'json':
      return 'json'; // Monaco has built-in JSON support
    default:
      return null;
  }
}

/**
 * Get MIME type for language
 */
export function getLanguageMimeType(languageId: string): string {
  switch (languageId) {
    case TURTLE_LANGUAGE_ID:
      return 'text/turtle';
    case SPARQL_LANGUAGE_ID:
      return 'application/sparql-query';
    default:
      return 'text/plain';
  }
}

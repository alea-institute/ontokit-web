/**
 * Editor Support Module
 *
 * Provides language support, syntax highlighting, and LSP integration
 * for RDF-based ontology editing.
 *
 * Features:
 * - Monaco editor language definitions for Turtle and SPARQL
 * - TextMate-compatible tokenization (adapted from stardog-rdf-grammars)
 * - Auto-completion for common prefixes, properties, and SPARQL keywords
 * - LSP client for connecting to language servers
 * - Validation patterns adapted from skos-ttl-editor
 *
 * Usage with Monaco Editor:
 * ```typescript
 * import { registerRdfLanguages } from '@/lib/editor';
 * import * as monaco from 'monaco-editor';
 *
 * // Register all RDF languages before creating editor
 * registerRdfLanguages(monaco);
 *
 * // Create editor with Turtle language
 * const editor = monaco.editor.create(container, {
 *   value: ontologyContent,
 *   language: 'turtle',
 * });
 * ```
 *
 * Usage with LSP:
 * ```typescript
 * import { createTurtleLspClient } from '@/lib/editor';
 *
 * const lspClient = createTurtleLspClient(
 *   'ws://localhost:8000/ws/lsp/turtle',
 *   (uri, diagnostics) => {
 *     // Handle diagnostics
 *     console.log('Validation issues:', diagnostics);
 *   }
 * );
 *
 * await lspClient.connect();
 * await lspClient.openDocument('file:///ontology.ttl', content);
 * ```
 */

// Language definitions
export {
  registerRdfLanguages,
  RDF_LANGUAGE_IDS,
  detectLanguageFromExtension,
  getLanguageMimeType,
} from './languages';

export {
  TURTLE_LANGUAGE_ID,
  TURTLE_EXTENSIONS,
  registerTurtleLanguage,
  turtleLanguageConfiguration,
  turtleTokensProvider,
  commonPrefixes,
  commonProperties,
} from './languages/turtle';

export {
  SPARQL_LANGUAGE_ID,
  SPARQL_EXTENSIONS,
  registerSparqlLanguage,
  sparqlLanguageConfiguration,
  sparqlTokensProvider,
  sparqlKeywords,
  sparqlFunctions,
  sparqlTemplates,
} from './languages/sparql';

// LSP client
export {
  LspClient,
  createTurtleLspClient,
  createSparqlLspClient,
  type Diagnostic,
  type CompletionItem,
  type HoverResult,
  type LspClientOptions,
} from './lsp-client';

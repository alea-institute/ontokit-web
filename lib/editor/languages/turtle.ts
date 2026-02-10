/**
 * Turtle Language Support for Monaco Editor
 *
 * Adapted from stardog-rdf-grammars TextMate definitions.
 * Provides syntax highlighting, tokenization, and language configuration.
 */

// Monaco language ID
export const TURTLE_LANGUAGE_ID = 'turtle';

// File extensions
export const TURTLE_EXTENSIONS = ['.ttl', '.turtle', '.n3'];

// Monaco language configuration
export const turtleLanguageConfiguration = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'] as [string, string],
    ['[', ']'] as [string, string],
    ['(', ')'] as [string, string],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '<', close: '>' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '<', close: '>' },
  ],
  folding: {
    markers: {
      start: /^\s*#region\b/,
      end: /^\s*#endregion\b/,
    },
  },
};

// Monaco monarch tokenizer for Turtle
export const turtleTokensProvider = {
  defaultToken: '',
  tokenPostfix: '.turtle',

  keywords: ['a', 'true', 'false'],

  directives: ['@prefix', '@base', 'PREFIX', 'BASE'],

  typeKeywords: [
    'owl:Class', 'owl:ObjectProperty', 'owl:DatatypeProperty', 'owl:AnnotationProperty',
    'owl:Thing', 'owl:Nothing', 'owl:Ontology', 'owl:NamedIndividual',
    'rdfs:Class', 'rdfs:Resource', 'rdfs:Literal', 'rdfs:Datatype',
    'rdf:Property', 'rdf:List', 'rdf:Statement',
    'xsd:string', 'xsd:integer', 'xsd:decimal', 'xsd:boolean', 'xsd:dateTime',
  ],

  operators: ['^^', '@'],

  // Common namespace prefixes
  namespaces: [
    'rdf:', 'rdfs:', 'owl:', 'xsd:', 'xml:',
    'skos:', 'dc:', 'dcterms:', 'foaf:', 'schema:',
  ],

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // Directives (@prefix, @base, PREFIX, BASE)
      [/@?(?:prefix|base)\b/i, 'keyword'],
      [/(?:PREFIX|BASE)\b/, 'keyword'],

      // IRI references <...>
      [/<[^\s<>"{}|^`\\]*>/, 'string.link'],

      // Prefixed names (namespace:localname)
      [/(\w*:)(\w*)/, ['storage.type', 'variable']],

      // The 'a' keyword (rdf:type shorthand)
      [/\ba\b/, 'keyword'],

      // Language tags
      [/@[a-zA-Z]+(-[a-zA-Z0-9]+)*/, 'type'],

      // Datatype annotation
      [/\^\^/, 'operator'],

      // Triple-quoted strings
      [/"""/, 'string', '@tripleDoubleString'],
      [/'''/, 'string', '@tripleSingleString'],

      // Double-quoted strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated
      [/"/, 'string', '@doubleString'],

      // Single-quoted strings
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-terminated
      [/'/, 'string', '@singleString'],

      // Numbers
      [/[+-]?\d+\.\d*([eE][+-]?\d+)?/, 'number.float'],
      [/[+-]?\.\d+([eE][+-]?\d+)?/, 'number.float'],
      [/[+-]?\d+[eE][+-]?\d+/, 'number.float'],
      [/[+-]?\d+/, 'number'],

      // Booleans
      [/\b(?:true|false)\b/, 'keyword'],

      // Blank nodes
      [/_:\w+/, 'variable.predefined'],

      // Punctuation
      [/[;,.]/, 'delimiter'],
      [/[\[\]{}()]/, '@brackets'],
    ],

    doubleString: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    singleString: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],

    tripleDoubleString: [
      [/[^"]+/, 'string'],
      [/"""/, 'string', '@pop'],
      [/"/, 'string'],
    ],

    tripleSingleString: [
      [/[^']+/, 'string'],
      [/'''/, 'string', '@pop'],
      [/'/, 'string'],
    ],
  },
};

// Common Turtle prefixes for auto-completion
export const commonPrefixes = [
  { prefix: 'rdf', namespace: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
  { prefix: 'rdfs', namespace: 'http://www.w3.org/2000/01/rdf-schema#' },
  { prefix: 'owl', namespace: 'http://www.w3.org/2002/07/owl#' },
  { prefix: 'xsd', namespace: 'http://www.w3.org/2001/XMLSchema#' },
  { prefix: 'xml', namespace: 'http://www.w3.org/XML/1998/namespace' },
  { prefix: 'skos', namespace: 'http://www.w3.org/2004/02/skos/core#' },
  { prefix: 'dc', namespace: 'http://purl.org/dc/elements/1.1/' },
  { prefix: 'dcterms', namespace: 'http://purl.org/dc/terms/' },
  { prefix: 'foaf', namespace: 'http://xmlns.com/foaf/0.1/' },
  { prefix: 'schema', namespace: 'https://schema.org/' },
];

// Common RDF/OWL properties for auto-completion
export const commonProperties = [
  // RDF
  { label: 'rdf:type', detail: 'The type of a resource' },
  { label: 'rdf:first', detail: 'First element of a list' },
  { label: 'rdf:rest', detail: 'Rest of a list' },
  // RDFS
  { label: 'rdfs:label', detail: 'Human-readable label' },
  { label: 'rdfs:comment', detail: 'Human-readable description' },
  { label: 'rdfs:subClassOf', detail: 'Subclass relationship' },
  { label: 'rdfs:subPropertyOf', detail: 'Subproperty relationship' },
  { label: 'rdfs:domain', detail: 'Domain of a property' },
  { label: 'rdfs:range', detail: 'Range of a property' },
  { label: 'rdfs:seeAlso', detail: 'Reference to related resource' },
  { label: 'rdfs:isDefinedBy', detail: 'Defining resource' },
  // OWL
  { label: 'owl:equivalentClass', detail: 'Equivalent class' },
  { label: 'owl:disjointWith', detail: 'Disjoint class' },
  { label: 'owl:inverseOf', detail: 'Inverse property' },
  { label: 'owl:deprecated', detail: 'Deprecated annotation' },
  { label: 'owl:versionInfo', detail: 'Version information' },
  { label: 'owl:imports', detail: 'Import another ontology' },
  // SKOS
  { label: 'skos:prefLabel', detail: 'Preferred label' },
  { label: 'skos:altLabel', detail: 'Alternative label' },
  { label: 'skos:definition', detail: 'Definition' },
  { label: 'skos:broader', detail: 'Broader concept' },
  { label: 'skos:narrower', detail: 'Narrower concept' },
];

/**
 * Register Turtle language with Monaco editor
 */
export function registerTurtleLanguage(monaco: typeof import('monaco-editor')) {
  // Register the language
  monaco.languages.register({
    id: TURTLE_LANGUAGE_ID,
    extensions: TURTLE_EXTENSIONS,
    aliases: ['Turtle', 'turtle', 'ttl', 'N3'],
    mimetypes: ['text/turtle', 'application/x-turtle'],
  });

  // Set language configuration
  monaco.languages.setLanguageConfiguration(
    TURTLE_LANGUAGE_ID,
    turtleLanguageConfiguration
  );

  // Set monarch tokenizer
  monaco.languages.setMonarchTokensProvider(
    TURTLE_LANGUAGE_ID,
    turtleTokensProvider as unknown as import('monaco-editor').languages.IMonarchLanguage
  );

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(TURTLE_LANGUAGE_ID, {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // Prefix suggestions
        ...commonPrefixes.map((p) => ({
          label: `@prefix ${p.prefix}:`,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `@prefix ${p.prefix}: <${p.namespace}> .`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: p.namespace,
          range,
        })),
        // Property suggestions
        ...commonProperties.map((p) => ({
          label: p.label,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: p.label,
          detail: p.detail,
          range,
        })),
      ];

      return { suggestions };
    },
  });
}

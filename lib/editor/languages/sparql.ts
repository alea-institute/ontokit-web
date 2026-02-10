/**
 * SPARQL Language Support for Monaco Editor
 *
 * Adapted from stardog-rdf-grammars TextMate definitions.
 * Provides syntax highlighting, tokenization, and language configuration.
 */

// Monaco language ID
export const SPARQL_LANGUAGE_ID = 'sparql';

// File extensions
export const SPARQL_EXTENSIONS = ['.rq', '.sparql', '.sq'];

// Monaco language configuration
export const sparqlLanguageConfiguration = {
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
};

// SPARQL keywords
export const sparqlKeywords = [
  // Query forms
  'SELECT', 'DISTINCT', 'REDUCED', 'CONSTRUCT', 'DESCRIBE', 'ASK',
  // Dataset clauses
  'FROM', 'NAMED',
  // Where clause
  'WHERE', 'GRAPH',
  // Solution modifiers
  'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'GROUP', 'HAVING',
  // Aggregates
  'COUNT', 'SUM', 'MIN', 'MAX', 'AVG', 'SAMPLE', 'GROUP_CONCAT', 'SEPARATOR',
  // Patterns
  'OPTIONAL', 'UNION', 'FILTER', 'BIND', 'AS', 'VALUES', 'MINUS',
  // Existence
  'EXISTS', 'NOT',
  // Service
  'SERVICE', 'SILENT',
  // Update
  'INSERT', 'DELETE', 'DATA', 'LOAD', 'CLEAR', 'DROP', 'CREATE',
  'ADD', 'MOVE', 'COPY', 'WITH', 'USING', 'DEFAULT', 'ALL', 'TO',
  // Prefix/Base
  'PREFIX', 'BASE',
  // Other
  'IN', 'A',
];

// SPARQL built-in functions
export const sparqlFunctions = [
  // String functions
  'STR', 'LANG', 'LANGMATCHES', 'DATATYPE', 'BOUND', 'IRI', 'URI', 'BNODE',
  'RAND', 'ABS', 'CEIL', 'FLOOR', 'ROUND', 'CONCAT', 'STRLEN', 'UCASE', 'LCASE',
  'ENCODE_FOR_URI', 'CONTAINS', 'STRSTARTS', 'STRENDS', 'STRBEFORE', 'STRAFTER',
  'YEAR', 'MONTH', 'DAY', 'HOURS', 'MINUTES', 'SECONDS', 'TIMEZONE', 'TZ',
  'NOW', 'UUID', 'STRUUID', 'MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512',
  'COALESCE', 'IF', 'STRLANG', 'STRDT', 'SAMETERM', 'ISIRI', 'ISURI', 'ISBLANK',
  'ISLITERAL', 'ISNUMERIC', 'REGEX', 'SUBSTR', 'REPLACE',
];

// Monaco monarch tokenizer for SPARQL
export const sparqlTokensProvider = {
  defaultToken: '',
  tokenPostfix: '.sparql',
  ignoreCase: true,

  keywords: sparqlKeywords,
  functions: sparqlFunctions,

  operators: [
    '||', '&&', '=', '!=', '<', '>', '<=', '>=',
    '+', '-', '*', '/', '!', '^^', '@',
  ],

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // Variables (?var or $var)
      [/[?$][a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],

      // Keywords
      [/\b(SELECT|DISTINCT|REDUCED|CONSTRUCT|DESCRIBE|ASK|FROM|NAMED|WHERE|GRAPH|ORDER|BY|ASC|DESC|LIMIT|OFFSET|GROUP|HAVING|OPTIONAL|UNION|FILTER|BIND|AS|VALUES|MINUS|EXISTS|NOT|SERVICE|SILENT|INSERT|DELETE|DATA|LOAD|CLEAR|DROP|CREATE|ADD|MOVE|COPY|WITH|USING|DEFAULT|ALL|TO|PREFIX|BASE|IN)\b/i, 'keyword'],

      // Aggregate keywords
      [/\b(COUNT|SUM|MIN|MAX|AVG|SAMPLE|GROUP_CONCAT|SEPARATOR)\b/i, 'keyword'],

      // Built-in functions
      [/\b(STR|LANG|LANGMATCHES|DATATYPE|BOUND|IRI|URI|BNODE|RAND|ABS|CEIL|FLOOR|ROUND|CONCAT|STRLEN|UCASE|LCASE|ENCODE_FOR_URI|CONTAINS|STRSTARTS|STRENDS|STRBEFORE|STRAFTER|YEAR|MONTH|DAY|HOURS|MINUTES|SECONDS|TIMEZONE|TZ|NOW|UUID|STRUUID|MD5|SHA1|SHA256|SHA384|SHA512|COALESCE|IF|STRLANG|STRDT|SAMETERM|ISIRI|ISURI|ISBLANK|ISLITERAL|ISNUMERIC|REGEX|SUBSTR|REPLACE)\b/i, 'support.function'],

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
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@doubleString'],

      // Single-quoted strings
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'/, 'string', '@singleString'],

      // Numbers
      [/[+-]?\d+\.\d*([eE][+-]?\d+)?/, 'number.float'],
      [/[+-]?\.\d+([eE][+-]?\d+)?/, 'number.float'],
      [/[+-]?\d+[eE][+-]?\d+/, 'number.float'],
      [/[+-]?\d+/, 'number'],

      // Booleans
      [/\b(?:true|false)\b/i, 'keyword'],

      // Blank nodes
      [/_:\w+/, 'variable.predefined'],

      // Operators
      [/\|\||&&|=|!=|<=?|>=?|\+|-|\*|\/|!/, 'operator'],

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

// SPARQL query templates for auto-completion
export const sparqlTemplates = [
  {
    label: 'SELECT query',
    detail: 'Basic SELECT query template',
    insertText: `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 100`,
  },
  {
    label: 'SELECT DISTINCT',
    detail: 'SELECT query with DISTINCT',
    insertText: `SELECT DISTINCT ?subject
WHERE {
  ?subject a <\${1:type}> .
}`,
  },
  {
    label: 'CONSTRUCT query',
    detail: 'CONSTRUCT query template',
    insertText: `CONSTRUCT {
  ?s ?p ?o .
}
WHERE {
  ?s ?p ?o .
}`,
  },
  {
    label: 'ASK query',
    detail: 'ASK query template',
    insertText: `ASK {
  <\${1:subject}> ?p ?o .
}`,
  },
  {
    label: 'DESCRIBE query',
    detail: 'DESCRIBE query template',
    insertText: `DESCRIBE <\${1:resource}>`,
  },
  {
    label: 'INSERT DATA',
    detail: 'Insert data template',
    insertText: `INSERT DATA {
  <\${1:subject}> <\${2:predicate}> <\${3:object}> .
}`,
  },
  {
    label: 'DELETE WHERE',
    detail: 'Delete matching triples',
    insertText: `DELETE WHERE {
  ?s ?p ?o .
  FILTER (?s = <\${1:subject}>)
}`,
  },
  {
    label: 'FILTER with REGEX',
    detail: 'Filter with regular expression',
    insertText: `FILTER (REGEX(?label, "\${1:pattern}", "i"))`,
  },
  {
    label: 'OPTIONAL',
    detail: 'Optional graph pattern',
    insertText: `OPTIONAL {
  ?s <\${1:predicate}> ?value .
}`,
  },
  {
    label: 'UNION',
    detail: 'Union of patterns',
    insertText: `{
  ?s <\${1:pred1}> ?o .
}
UNION
{
  ?s <\${2:pred2}> ?o .
}`,
  },
];

/**
 * Register SPARQL language with Monaco editor
 */
export function registerSparqlLanguage(monaco: typeof import('monaco-editor')) {
  // Register the language
  monaco.languages.register({
    id: SPARQL_LANGUAGE_ID,
    extensions: SPARQL_EXTENSIONS,
    aliases: ['SPARQL', 'sparql', 'rq'],
    mimetypes: ['application/sparql-query', 'application/sparql-update'],
  });

  // Set language configuration
  monaco.languages.setLanguageConfiguration(
    SPARQL_LANGUAGE_ID,
    sparqlLanguageConfiguration
  );

  // Set monarch tokenizer
  monaco.languages.setMonarchTokensProvider(
    SPARQL_LANGUAGE_ID,
    sparqlTokensProvider as unknown as import('monaco-editor').languages.IMonarchLanguage
  );

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(SPARQL_LANGUAGE_ID, {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        // Keyword suggestions
        ...sparqlKeywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        })),
        // Function suggestions
        ...sparqlFunctions.map((fn) => ({
          label: fn,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${fn}(\${1})`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
        // Template suggestions
        ...sparqlTemplates.map((t) => ({
          label: t.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: t.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: t.detail,
          range,
        })),
      ];

      return { suggestions };
    },
  });
}

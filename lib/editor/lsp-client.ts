/**
 * Language Server Protocol Client for RDF Languages
 *
 * This module provides a WebSocket-based LSP client that can connect to
 * language servers for Turtle, SPARQL, and SHACL validation.
 *
 * The language servers are npm packages that can be run via Node.js:
 * - turtle-language-server (^3.4.0)
 * - sparql-language-server (^4.1.0)
 * - shacl-language-server (^1.5.0)
 *
 * For browser-based usage, you need a WebSocket bridge that proxies
 * stdio communication with the language server.
 */

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string | number;
}

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface HoverResult {
  contents: string | { language: string; value: string }[];
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LspClientOptions {
  /** WebSocket URL to the language server bridge */
  serverUrl: string;
  /** Language ID (turtle, sparql, shacl) */
  languageId: string;
  /** Callback when diagnostics are received */
  onDiagnostics?: (uri: string, diagnostics: Diagnostic[]) => void;
  /** Callback when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * LSP Client for browser-based editor integration
 *
 * Note: This requires a WebSocket server that bridges to the language server.
 * The backend API can provide this bridge using the language server packages.
 */
export class LspClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private options: LspClientOptions;
  private documentVersions: Map<string, number> = new Map();

  constructor(options: LspClientOptions) {
    this.options = options;
  }

  /**
   * Connect to the language server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.serverUrl);

      this.ws.onopen = async () => {
        this.options.onConnectionChange?.(true);

        // Initialize the language server
        try {
          await this.initialize();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.ws.onclose = () => {
        this.options.onConnectionChange?.(false);
      };

      this.ws.onerror = (_error) => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  /**
   * Disconnect from the language server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a document for validation
   */
  async openDocument(uri: string, content: string): Promise<void> {
    const version = 1;
    this.documentVersions.set(uri, version);

    await this.notify('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: this.options.languageId,
        version,
        text: content,
      },
    });
  }

  /**
   * Update document content
   */
  async updateDocument(uri: string, content: string): Promise<void> {
    const version = (this.documentVersions.get(uri) || 0) + 1;
    this.documentVersions.set(uri, version);

    await this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: content }],
    });
  }

  /**
   * Close a document
   */
  async closeDocument(uri: string): Promise<void> {
    this.documentVersions.delete(uri);

    await this.notify('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  /**
   * Request completions at position
   */
  async getCompletions(
    uri: string,
    line: number,
    character: number
  ): Promise<CompletionItem[]> {
    const result = await this.request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });

    if (!result) return [];

    const resultObj = result as { items?: Record<string, unknown>[] } | Record<string, unknown>[];
    const items: Record<string, unknown>[] = Array.isArray(resultObj) ? resultObj : (resultObj.items || []);
    return items.map((item) => ({
      label: item.label as string,
      kind: this.getCompletionKindName(item.kind as number),
      detail: item.detail as string | undefined,
      documentation: this.extractDocumentation(item.documentation),
      insertText: (item.insertText as string) || (item.label as string),
    }));
  }

  /**
   * Request hover information
   */
  async getHover(
    uri: string,
    line: number,
    character: number
  ): Promise<HoverResult | null> {
    const result = await this.request('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });

    if (!result) return null;

    const hoverResult = result as { contents?: unknown; range?: HoverResult['range'] };
    return {
      contents: this.extractHoverContents(hoverResult.contents),
      range: hoverResult.range,
    };
  }

  // Private methods

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      processId: null,
      capabilities: {
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true,
            didClose: true,
          },
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            contentFormat: ['markdown', 'plaintext'],
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
        },
      },
      rootUri: null,
    });

    await this.notify('initialized', {});
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.send({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 30000);
    });
  }

  private async notify(method: string, params: unknown): Promise<void> {
    this.send({
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  private send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    // Response to a request
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id as number);
      if (pending) {
        this.pendingRequests.delete(message.id as number);
        if (message.error) {
          pending.reject(new Error((message.error as Record<string, string>).message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Notification from server
    if (message.method === 'textDocument/publishDiagnostics') {
      const params = message.params as {
        uri: string;
        diagnostics: Array<{
          range: { start: { line: number; character: number }; end: { line: number; character: number } };
          severity?: number;
          message: string;
          source?: string;
          code?: string | number;
        }>;
      };
      const diagnostics: Diagnostic[] = params.diagnostics.map((d) => ({
        range: d.range,
        severity: this.getSeverityName(d.severity),
        message: d.message,
        source: d.source,
        code: d.code,
      }));
      this.options.onDiagnostics?.(params.uri, diagnostics);
    }
  }

  private getSeverityName(severity?: number): 'error' | 'warning' | 'info' | 'hint' {
    switch (severity) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'hint';
      default: return 'info';
    }
  }

  private getCompletionKindName(kind?: number): string {
    const kinds: Record<number, string> = {
      1: 'text', 2: 'method', 3: 'function', 4: 'constructor',
      5: 'field', 6: 'variable', 7: 'class', 8: 'interface',
      9: 'module', 10: 'property', 11: 'unit', 12: 'value',
      13: 'enum', 14: 'keyword', 15: 'snippet', 16: 'color',
      17: 'file', 18: 'reference', 19: 'folder', 20: 'enumMember',
      21: 'constant', 22: 'struct', 23: 'event', 24: 'operator',
      25: 'typeParameter',
    };
    return kinds[kind || 0] || 'text';
  }

  private extractDocumentation(doc: unknown): string | undefined {
    if (!doc) return undefined;
    if (typeof doc === 'string') return doc;
    if (typeof doc === 'object' && doc !== null) {
      const docObj = doc as Record<string, unknown>;
      return docObj.value as string || docObj.contents as string;
    }
    return undefined;
  }

  private extractHoverContents(contents: unknown): string | { language: string; value: string }[] {
    if (typeof contents === 'string') return contents;
    if (Array.isArray(contents)) {
      return contents.map((c) => {
        if (typeof c === 'string') return { language: 'text', value: c };
        return c as { language: string; value: string };
      });
    }
    if (typeof contents === 'object' && contents !== null) {
      const contentsObj = contents as Record<string, unknown>;
      return contentsObj.value as string || '';
    }
    return '';
  }
}

/**
 * Create an LSP client for Turtle
 */
export function createTurtleLspClient(
  serverUrl: string,
  onDiagnostics?: (uri: string, diagnostics: Diagnostic[]) => void
): LspClient {
  return new LspClient({
    serverUrl,
    languageId: 'turtle',
    onDiagnostics,
  });
}

/**
 * Create an LSP client for SPARQL
 */
export function createSparqlLspClient(
  serverUrl: string,
  onDiagnostics?: (uri: string, diagnostics: Diagnostic[]) => void
): LspClient {
  return new LspClient({
    serverUrl,
    languageId: 'sparql',
    onDiagnostics,
  });
}

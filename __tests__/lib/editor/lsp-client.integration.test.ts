import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LspClient, createSparqlLspClient, createTurtleLspClient } from "@/lib/editor/lsp-client";

interface RpcMessage { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } }
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: RpcMessage[] = [];
  constructor(readonly url: string) { Socket.instances.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = Socket.OPEN; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(message: RpcMessage) { this.onmessage?.({ data: JSON.stringify({ jsonrpc: "2.0", ...message }) }); }
}
const uri = "file:///ontology.ttl";
const options = { serverUrl: "ws://fixture.invalid/lsp", languageId: "turtle" };
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function connected(client = new LspClient(options)) {
  const pending = client.connect();
  const socket = Socket.instances.at(-1)!;
  socket.open();
  socket.receive({ id: socket.sent[0].id, result: { capabilities: {} } });
  await pending;
  return { client, socket };
}

describe("LSP client through its JSON WebSocket boundary", () => {
  it("starts an untracked document at version one and stops sending after disconnect", async () => {
    const diagnostics = vi.fn();
    const { client, socket } = await connected(new LspClient({ ...options, onDiagnostics: diagnostics }));
    await client.updateDocument(uri, "first update");
    expect(socket.sent.at(-1)).toMatchObject({ method: "textDocument/didChange", params: { textDocument: { uri, version: 1 }, contentChanges: [{ text: "first update" }] } });
    socket.receive({ method: "window/logMessage", params: { type: 3, message: "Server ready" } });
    expect(diagnostics).not.toHaveBeenCalled();
    client.disconnect();
    const sent = socket.sent.length;
    await client.updateDocument(uri, "offline update");
    await client.closeDocument(uri);
    expect(socket.sent).toHaveLength(sent);
  });

  it("initializes the protocol, versions document edits, and resets a reopened document", async () => {
    const changed = vi.fn();
    const { client, socket } = await connected(new LspClient({ ...options, onConnectionChange: changed }));
    expect(socket.url).toBe(options.serverUrl);
    expect(socket.sent[0]).toMatchObject({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: null, capabilities: { textDocument: { completion: { completionItem: { snippetSupport: true } } } } } });
    expect(socket.sent[1]).toEqual({ jsonrpc: "2.0", method: "initialized", params: {} });
    await client.openDocument(uri, "original");
    await client.updateDocument(uri, "changed");
    await client.updateDocument(uri, "latest");
    await client.closeDocument(uri);
    await client.openDocument(uri, "reopened");
    expect(socket.sent.slice(2).map(message => [message.method, message.params])).toEqual([
      ["textDocument/didOpen", { textDocument: { uri, languageId: "turtle", version: 1, text: "original" } }],
      ["textDocument/didChange", { textDocument: { uri, version: 2 }, contentChanges: [{ text: "changed" }] }],
      ["textDocument/didChange", { textDocument: { uri, version: 3 }, contentChanges: [{ text: "latest" }] }],
      ["textDocument/didClose", { textDocument: { uri } }],
      ["textDocument/didOpen", { textDocument: { uri, languageId: "turtle", version: 1, text: "reopened" } }],
    ]);
    client.disconnect(); client.disconnect();
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it.each([["turtle", createTurtleLspClient], ["sparql", createSparqlLspClient]] as const)("opens documents with the %s factory's language", async (language, factory) => {
    const { client, socket } = await connected(factory(options.serverUrl));
    await client.openDocument(uri, "content");
    expect(socket.sent.at(-1)?.params).toEqual({ textDocument: { uri, languageId: language, version: 1, text: "content" } });
  });

  it.each([null, {}, [], { items: [] }])("returns no completions for an empty result %j", async result => {
    const { client, socket } = await connected();
    const pending = client.getCompletions(uri, 2, 4);
    const request = socket.sent.at(-1)!;
    expect(request).toMatchObject({ method: "textDocument/completion", params: { textDocument: { uri }, position: { line: 2, character: 4 } } });
    socket.receive({ id: request.id, result });
    expect(await pending).toEqual([]);
  });

  it("keeps completions usable when the server sends an unsupported documentation primitive", async () => {
    const { client, socket } = await connected();
    const pending = client.getCompletions(uri, 0, 0);
    socket.receive({ id: socket.sent.at(-1)!.id, result: [{ label: "Thing", kind: 7, documentation: 42, insertText: "ex:Thing" }] });
    expect(await pending).toEqual([{ label: "Thing", kind: "class", detail: undefined, documentation: undefined, insertText: "ex:Thing" }]);
    client.disconnect();
  });

  it.each([true, false])("normalizes completion documentation and insertion text from a list wrapper: %s", async wrapped => {
    const { client, socket } = await connected();
    const pending = client.getCompletions(uri, 0, 0);
    const items = [{ label: "Thing", kind: 7, detail: "A class", documentation: { value: "Markdown" }, insertText: "ex:Thing" }, { label: "Name", kind: 999, documentation: "Plain" }, { label: "Other", documentation: { contents: "Fallback" } }];
    socket.receive({ id: socket.sent.at(-1)!.id, result: wrapped ? { items } : items });
    expect(await pending).toEqual([
      { label: "Thing", kind: "class", detail: "A class", documentation: "Markdown", insertText: "ex:Thing" },
      { label: "Name", kind: "text", detail: undefined, documentation: "Plain", insertText: "Name" },
      { label: "Other", kind: "text", detail: undefined, documentation: "Fallback", insertText: "Other" },
    ]);
  });

  it.each([
    ["plain", "plain"],
    [["plain", { language: "turtle", value: "ex:Thing" }], [{ language: "text", value: "plain" }, { language: "turtle", value: "ex:Thing" }]],
    [{ kind: "markdown", value: "**Thing**" }, "**Thing**"],
    [{}, ""],
    [undefined, ""],
  ])("normalizes hover contents %j and preserves the source range", async (contents, expected) => {
    const { client, socket } = await connected();
    const range = { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } };
    const pending = client.getHover(uri, 1, 3);
    socket.receive({ id: socket.sent.at(-1)!.id, result: { contents, range } });
    expect(await pending).toEqual({ contents: expected, range });
  });

  it("matches out-of-order responses to their requests and ignores unknown response IDs", async () => {
    const { client, socket } = await connected();
    const completion = client.getCompletions(uri, 0, 1);
    const completionId = socket.sent.at(-1)!.id;
    const hover = client.getHover(uri, 0, 1);
    socket.receive({ id: 999, result: "unrelated" });
    socket.receive({ id: socket.sent.at(-1)!.id, result: null });
    socket.receive({ id: completionId, result: [{ label: "Only completion" }] });
    expect(await hover).toBeNull();
    expect(await completion).toEqual([{ label: "Only completion", kind: "text", insertText: "Only completion", detail: undefined, documentation: undefined }]);
  });

  it("converts diagnostic severities and retains ranges, source and code", async () => {
    const diagnostics = vi.fn();
    const { socket } = await connected(new LspClient({ ...options, onDiagnostics: diagnostics }));
    const range = { start: { line: 0, character: 1 }, end: { line: 0, character: 4 } };
    socket.receive({ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [1, 2, 3, 4, undefined].map(severity => ({ range, severity, message: "Problem", source: "turtle", code: 42 })) } });
    expect(diagnostics).toHaveBeenCalledExactlyOnceWith(uri, ["error", "warning", "info", "hint", "info"].map(severity => ({ range, severity, message: "Problem", source: "turtle", code: 42 })));
    socket.receive({ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } });
    expect(diagnostics).toHaveBeenLastCalledWith(uri, []);
  });

  it("rejects a server error without corrupting the next request", async () => {
    const { client, socket } = await connected();
    const pending = client.getHover(uri, 0, 0);
    const rejected = expect(pending).rejects.toThrow("Invalid document");
    socket.receive({ id: socket.sent.at(-1)!.id, error: { message: "Invalid document" } });
    await rejected;
    const next = client.getHover(uri, 0, 0);
    socket.receive({ id: socket.sent.at(-1)!.id, result: { contents: "Recovered" } });
    expect(await next).toMatchObject({ contents: "Recovered" });
  });

  it("times out an unanswered request and ignores its later response", async () => {
    const { client, socket } = await connected();
    const pending = client.getHover(uri, 0, 0);
    const id = socket.sent.at(-1)!.id;
    const rejected = expect(pending).rejects.toThrow("Request textDocument/hover timed out");
    await vi.advanceTimersByTimeAsync(30000);
    await rejected;
    expect(() => socket.receive({ id, result: { contents: "Too late" } })).not.toThrow();
  });

  it("rejects a failed connection and a rejected initialize handshake", async () => {
    const client = new LspClient(options);
    const failed = client.connect();
    const rejected = expect(failed).rejects.toThrow("WebSocket connection failed");
    Socket.instances.at(-1)!.onerror?.(); await rejected;
    const retry = client.connect();
    const rejectedInit = expect(retry).rejects.toThrow("Unsupported protocol");
    const socket = Socket.instances.at(-1)!; socket.open();
    socket.receive({ id: socket.sent[0].id, error: { message: "Unsupported protocol" } });
    await rejectedInit;
  });
});

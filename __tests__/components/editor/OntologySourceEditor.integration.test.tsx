import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OntologySourceEditor, type OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import type { IndexWorkerMessage, IndexWorkerResult } from "@/lib/editor/indexWorker";
import { loadIndexWorker } from "../../fixtures/index-worker-harness";

let processMessage: Awaited<ReturnType<typeof loadIndexWorker>>;
beforeAll(async () => { processMessage = await loadIndexWorker(); });

const bridge = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock("@monaco-editor/react", () => ({
  default: (props: Record<string, unknown>) => {
    bridge.props = props;
    return <textarea aria-label="Source" value={props.value as string} onChange={event => (props.onChange as (value: string) => void)(event.target.value)} />;
  },
  loader: { config: vi.fn() },
}));
class IndexWorker {
  static instances: IndexWorker[] = [];
  onmessage: ((event: MessageEvent<IndexWorkerResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { IndexWorker.instances.push(this); }
}
const content = '@prefix ex: <https://example.org/> .\nex:Thing a <http://www.w3.org/2002/07/owl#Class> .';
const issue = { id: "missing", rule_id: "missing-label", message: "A label is needed", subject_iri: "https://example.org/Thing", issue_type: "warning" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
let fetcher: ReturnType<typeof vi.fn>;
const position = { line: 2, col: 1, len: 8 };
function result(): IndexWorkerResult {
  return { type: "result", positions: [[issue.id, position]], iriIndex: [[issue.subject_iri, position]], iriLabels: [[issue.subject_iri, "Thing"]], diagnostics: [{ issueId: issue.id, startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 9, message: "[missing-label] A label is needed", severity: "warning" }], stats: { linesProcessed: 2, irisIndexed: 1, localNamesIndexed: 1, issuesMatched: 1, timeMs: 1 } };
}
function mountEditor() {
  const model = { getValue: () => bridge.props.value, isDisposed: () => false, getLineContent: () => "", getLineCount: () => 2 };
  let mouse: (event: unknown) => void = () => {};
  const editor = { getModel: () => model, revealLineInCenter: vi.fn(), setPosition: vi.fn(), focus: vi.fn(), onMouseDown: (handler: typeof mouse) => { mouse = handler; } };
  const monaco = { editor: { setModelMarkers: vi.fn(), MouseTargetType: { GUTTER_GLYPH_MARGIN: 2 } }, MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 } };
  act(() => (bridge.props.onMount as (e: typeof editor, m: typeof monaco) => void)(editor, monaco));
  return { editor, monaco, clickDiagnostic: () => act(() => mouse({ target: { type: 2, position: { lineNumber: 2, column: 1 } }, event: { ctrlKey: false, metaKey: false } })) };
}
beforeEach(() => {
  IndexWorker.instances = [];
  vi.stubGlobal("Worker", IndexWorker);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  fetcher = vi.fn(async () => json({ items: [issue] }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const props = { projectId: "source-project", accessToken: "source-token", initialValue: content };

describe("source editor integration through real TurtleEditor and lint API", () => {
  it("navigates indexed diagnostics when Monaco finishes loading after the lint results", async () => {
    const navigate = vi.fn();
    render(<OntologySourceEditor {...props} onNavigateToClass={navigate} />);
    await screen.findByText(issue.message);
    await waitFor(() => expect(IndexWorker.instances.at(-1)?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ issues: [expect.objectContaining({ id: issue.id })] })));
    const worker = IndexWorker.instances.at(-1)!;
    const message = worker.postMessage.mock.calls.at(-1)![0] as IndexWorkerMessage;
    act(() => worker.onmessage?.({ data: processMessage(message) } as MessageEvent<IndexWorkerResult>));
    const mounted = mountEditor();
    mounted.clickDiagnostic();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(issue.subject_iri);
  });

  it("orders lint issues by real indexed source lines and navigates the selected issue", async () => {
    vi.stubGlobal("Worker", class {
      onmessage: ((event: MessageEvent<IndexWorkerResult>) => void) | null = null;
      private stopped = false;
      postMessage(message: IndexWorkerMessage) {
        queueMicrotask(() => {
          if (!this.stopped) this.onmessage?.({ data: processMessage(message) } as MessageEvent<IndexWorkerResult>);
        });
      }
      terminate() { this.stopped = true; }
    });
    const issues = [
      { ...issue, id: "later", message: "Later definition", subject_iri: "https://example.org/Later" },
      { ...issue, id: "earlier", message: "Earlier definition" },
      { ...issue, id: "unmatched", message: "Missing definition", subject_iri: "https://example.org/Absent" },
    ];
    fetcher.mockResolvedValue(json({ items: issues }));
    render(<OntologySourceEditor {...props} initialValue={`${content}\n\nex:Later a <http://www.w3.org/2002/07/owl#Class> .`} />);
    const { editor, monaco } = mountEditor();
    await screen.findByText("Ln 4");
    const buttons = screen.getAllByRole("button").filter(button => /definition/.test(button.textContent ?? ""));
    expect(buttons.map(button => button.textContent)).toEqual([
      expect.stringContaining("Earlier definition"), expect.stringContaining("Later definition"), expect.stringContaining("Missing definition"),
    ]);
    fireEvent.click(screen.getByText("Later definition"));
    expect(editor.setPosition).toHaveBeenLastCalledWith({ lineNumber: 4, column: 1 });
    expect(editor.revealLineInCenter).toHaveBeenLastCalledWith(4);
    await waitFor(() => expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(expect.anything(), "turtle-linter", expect.arrayContaining([
      expect.objectContaining({ startLineNumber: 4, message: "[missing-label] Later definition" }),
      expect.objectContaining({ startLineNumber: 2, message: "[missing-label] Earlier definition" }),
    ])));
  });

  it("navigates an indexed duplicate without also jumping to the issue subject", async () => {
    const duplicateIri = "https://example.org/Other";
    const duplicate = { line: 3, col: 2, len: 8 };
    fetcher.mockResolvedValue(json({ items: [{ ...issue, details: { duplicate_iris: [duplicateIri, "https://example.org/Absent"] } }] }));
    render(<OntologySourceEditor {...props} initialValue={`${content}\n ex:Other a <http://www.w3.org/2002/07/owl#Class> .`} />);
    const { editor } = mountEditor();
    await screen.findByText(issue.message);
    await waitFor(() => expect(IndexWorker.instances.at(-1)?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ issues: [expect.objectContaining({ id: issue.id })] })));
    const indexed = result();
    indexed.iriIndex.push([duplicateIri, duplicate]);
    act(() => IndexWorker.instances.at(-1)!.onmessage?.({ data: indexed } as MessageEvent<IndexWorkerResult>));
    editor.setPosition.mockClear();
    expect(screen.getByRole("button", { name: "Other" }).parentElement?.closest('button')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(editor.setPosition).toHaveBeenCalledExactlyOnceWith({ lineNumber: 3, column: 2 });
    expect(editor.revealLineInCenter).toHaveBeenLastCalledWith(3);
    expect(screen.getByTitle("https://example.org/Absent").tagName).toBe("SPAN");
  });

  it("loads authenticated lint, maps worker results to navigation and Monaco diagnostics", async () => {
    const navigate = vi.fn();
    render(<OntologySourceEditor {...props} onNavigateToClass={navigate} />);
    const mounted = mountEditor();
    await screen.findByText(issue.message);
    await waitFor(() => expect(IndexWorker.instances.at(-1)?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ content, issues: [expect.objectContaining({ id: issue.id })] })));
    const worker = IndexWorker.instances.at(-1)!;
    act(() => worker.onmessage?.({ data: result() } as MessageEvent<IndexWorkerResult>));
    fireEvent.click(screen.getByText(issue.message));
    expect(mounted.editor.setPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 1 });
    await waitFor(() => expect(mounted.monaco.editor.setModelMarkers).toHaveBeenCalledWith(expect.anything(), "turtle-linter", [expect.objectContaining({ severity: 4, startLineNumber: 2 })]));
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get("include_resolved")).toBe("false");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer source-token");
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("falls back after a worker crash and restores indexed diagnostics after editing", async () => {
    const logged = vi.spyOn(console, "error");
    render(<OntologySourceEditor {...props} />);
    const { editor, monaco } = mountEditor();
    await screen.findByText(issue.message);
    await waitFor(() => expect(IndexWorker.instances.at(-1)?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ issues: [expect.objectContaining({ id: issue.id })] })));
    const crashed = IndexWorker.instances.at(-1)!;
    const error = new ErrorEvent("error", { message: "Worker stopped unexpectedly" });
    act(() => crashed.onerror?.(error));
    expect(logged).toHaveBeenCalledWith("Index worker error:", error);
    expect(crashed.terminate).toHaveBeenCalled();
    await waitFor(() => expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(expect.anything(), "turtle-linter", [expect.objectContaining({ startLineNumber: 1, severity: 4, message: "[missing-label] A label is needed" })]));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(content);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: `# edited\n${content}` } });
    const recovered = IndexWorker.instances.at(-1)!;
    expect(recovered).not.toBe(crashed);
    const message = recovered.postMessage.mock.calls.at(-1)![0] as IndexWorkerMessage;
    act(() => recovered.onmessage?.({ data: processMessage(message) } as MessageEvent<IndexWorkerResult>));
    await waitFor(() => expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(expect.anything(), "turtle-linter", [expect.objectContaining({ startLineNumber: 3, severity: 4 })]));
    fireEvent.click(screen.getByText(issue.message));
    expect(editor.setPosition).toHaveBeenLastCalledWith({ lineNumber: 3, column: 1 });
    expect(recovered.terminate).toHaveBeenCalled();
  });

  it("fulfills an imperative scroll queued before the local worker index arrives", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    render(<OntologySourceEditor {...props} ref={ref} />);
    const { editor } = mountEditor();
    await screen.findByText(issue.message);
    await waitFor(() => expect(IndexWorker.instances.at(-1)?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ issues: [expect.objectContaining({ id: issue.id })] })));
    expect(ref.current!.scrollToIri(issue.subject_iri)).toBe(true);
    expect(editor.setPosition).not.toHaveBeenCalled();
    act(() => IndexWorker.instances.at(-1)!.onmessage?.({ data: result() } as MessageEvent<IndexWorkerResult>));
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 2, column: 1 });
    expect(ref.current!.scrollToIri("https://elsewhere.org/Absent")).toBe(false);
  });

  it("preserves editable content when the lint endpoint fails and recovers on project change", async () => {
    const logged = vi.spyOn(console, "error");
    fetcher.mockResolvedValueOnce(json({ detail: "Lint unavailable" }, 403));
    const view = render(<OntologySourceEditor {...props} />);
    mountEditor();
    await waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to fetch lint issues:", expect.any(Error)));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(content);
    view.rerender(<OntologySourceEditor {...props} projectId="recovered" />);
    expect(await screen.findByText(issue.message)).toBeTruthy();
  });

  it("retries failed saves through the real change handler and keeps the new baseline on revert", async () => {
    const save = vi.fn().mockRejectedValueOnce("offline").mockResolvedValueOnce(undefined);
    render(<OntologySourceEditor {...props} onSave={save} />);
    mountEditor();
    await screen.findByText(issue.message);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: `${content}\n# changed` } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Failed to save")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Failed to save")).toBeNull());
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "another edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(`${content}\n# changed`);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("avoids requests and workers for an empty unbound editor while exposing a usable ref", () => {
    const ref = createRef<OntologySourceEditorRef>();
    render(<OntologySourceEditor projectId="" initialValue="" ref={ref} />);
    expect(fetcher).not.toHaveBeenCalled();
    expect(IndexWorker.instances).toHaveLength(0);
    expect(ref.current!.getValue()).toBe("");
    expect(() => ref.current!.insertAtEnd("unused before mount")).not.toThrow();
    act(() => ref.current!.replaceValue(""));
    expect(ref.current!.getValue()).toBe("");
  });
});

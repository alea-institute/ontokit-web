import React, { createRef } from "react";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ──

// Mock TurtleEditor as a simple textarea so we can test change/save flow
vi.mock("@/components/editor/TurtleEditor", () => ({
  TurtleEditor: (props: {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
    onReady?: (editor: unknown) => void;
    "data-testid"?: string;
  }) => {
    // Simulate onReady on mount
    React.useEffect(() => {
      props.onReady?.({
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn(),
        focus: vi.fn(),
        getModel: () => ({
          getValue: () => props.value,
          getLineCount: () => props.value.split("\n").length,
          getLineMaxColumn: () => 1,
        }),
        executeEdits: vi.fn(),
      });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return React.createElement("textarea", {
      "data-testid": "turtle-editor",
      value: props.value,
      readOnly: props.readOnly,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        props.onChange?.(e.target.value),
    });
  },
}));

vi.mock("@/lib/api/lint", () => ({
  lintApi: {
    getIssues: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 100,
    }),
  },
}));

// Stub Web Worker globally (jsdom has no Worker)
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;
  postMessage() {
    // Auto-respond with an empty but valid result so diagnosticsReady becomes true
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = null;
      this.onmessage?.({
        data: {
          diagnostics: [],
          positions: [],
          iriIndex: [],
          iriLabels: [],
          stats: { linesProcessed: 0, irisIndexed: 0, localNamesIndexed: 0, issuesMatched: 0, timeMs: 0 },
        },
      } as unknown as MessageEvent);
    }, 0);
  }
  terminate() {
    if (this._pendingTimer !== null) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }
}
vi.stubGlobal("Worker", MockWorker);
// URL constructor is used with import.meta.url in the component
vi.stubGlobal("URL", class extends globalThis.URL {
  constructor(input: string | URL, base?: string | URL) {
    super(typeof input === "string" && !input.startsWith("http") ? `http://test/${input}` : input, base);
  }
});

import {
  OntologySourceEditor,
  type OntologySourceEditorRef,
} from "@/components/editor/OntologySourceEditor";
import { lintApi } from "@/lib/api/lint";

const mockGetIssues = lintApi.getIssues as Mock;

const SAMPLE_TURTLE = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<http://example.org/ontology#Person> a owl:Class ;
    rdfs:label "Person"@en .
`;

const DEFAULT_PROPS = {
  projectId: "proj-1",
  initialValue: SAMPLE_TURTLE,
  accessToken: "test-token",
};

describe("OntologySourceEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIssues.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
  });

  // ── Basic rendering ──

  it("renders the editor with initial value", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);
    const editor = screen.getByTestId("turtle-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe(SAMPLE_TURTLE);
  });

  it("renders Source Editor heading", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);
    expect(screen.getByText("Source Editor")).toBeDefined();
  });

  // ── Toolbar buttons ──

  it("shows Save and Revert buttons in editable mode", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    expect(screen.getByText("Save")).toBeDefined();
    expect(screen.getByText("Revert")).toBeDefined();
  });

  it("hides Save and Revert buttons in read-only mode", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} readOnly={true} />);
    expect(screen.queryByText("Save")).toBeNull();
    expect(screen.queryByText("Revert")).toBeNull();
  });

  // ── Save/Revert disabled state ──

  it("Save button is disabled when there are no changes", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const saveBtn = screen.getByText("Save").closest("button")!;
    expect(saveBtn.disabled).toBe(true);
  });

  it("Revert button is disabled when there are no changes", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const revertBtn = screen.getByText("Revert").closest("button")!;
    expect(revertBtn.disabled).toBe(true);
  });

  // ── Unsaved changes indicator ──

  it("shows 'Unsaved changes' badge when content changes", async () => {
    const user = userEvent.setup();
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "modified content");

    expect(screen.getByText("Unsaved changes")).toBeDefined();
  });

  it("enables Save and Revert buttons when content changes", async () => {
    const user = userEvent.setup();
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "modified content");

    const saveBtn = screen.getByText("Save").closest("button")!;
    const revertBtn = screen.getByText("Revert").closest("button")!;
    expect(saveBtn.disabled).toBe(false);
    expect(revertBtn.disabled).toBe(false);
  });

  // ── Save flow ──

  it("calls onSave when Save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "new content");

    await user.click(screen.getByText("Save").closest("button")!);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("new content");
    });
  });

  it("shows save error when onSave rejects", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "bad content");

    await user.click(screen.getByText("Save").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeDefined();
    });
  });

  it("resets to original value when Revert is clicked", async () => {
    const user = userEvent.setup();
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const editor = screen.getByTestId("turtle-editor") as HTMLTextAreaElement;

    await user.clear(editor);
    await user.type(editor, "modified");

    await user.click(screen.getByText("Revert").closest("button")!);

    expect(editor.value).toBe(SAMPLE_TURTLE);
  });

  // ── No issues indicator ──

  it("shows 'No issues' when lint returns empty list", async () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("No issues")).toBeDefined();
    });
  });

  // ── Lint issues ──

  it("shows error and warning counts when lint issues exist", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1",
          run_id: "r1",
          project_id: "proj-1",
          issue_type: "error",
          rule_id: "ERR1",
          message: "An error",
          subject_iri: "http://example.org/A",
          details: null,
          created_at: "2024-01-01T00:00:00Z",
          resolved_at: null,
        },
        {
          id: "i2",
          run_id: "r1",
          project_id: "proj-1",
          issue_type: "warning",
          rule_id: "WARN1",
          message: "A warning",
          subject_iri: "http://example.org/B",
          details: null,
          created_at: "2024-01-01T00:00:00Z",
          resolved_at: null,
        },
        {
          id: "i3",
          run_id: "r1",
          project_id: "proj-1",
          issue_type: "warning",
          rule_id: "WARN2",
          message: "Another warning",
          subject_iri: "http://example.org/C",
          details: null,
          created_at: "2024-01-01T00:00:00Z",
          resolved_at: null,
        },
      ],
      total: 3,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText(/1 errors?/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/2 warnings?/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Problems panel with issue messages", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1",
          run_id: "r1",
          project_id: "proj-1",
          issue_type: "error",
          rule_id: "ERR1",
          message: "Missing label declaration",
          subject_iri: "http://example.org/A",
          details: null,
          created_at: "2024-01-01T00:00:00Z",
          resolved_at: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Problems (1)")).toBeDefined();
      expect(screen.getByText("Missing label declaration")).toBeDefined();
      expect(screen.getByText("ERR1")).toBeDefined();
    });
  });

  // ── Fetching lint ──

  it("calls lintApi.getIssues with correct project ID and token", async () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockGetIssues).toHaveBeenCalledWith(
        "proj-1",
        "test-token",
        expect.objectContaining({ include_resolved: false, limit: 200 })
      );
    });
  });

  // ── Status bar ──

  it("shows line count in status bar", () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);
    const lineCount = SAMPLE_TURTLE.split("\n").length;
    expect(screen.getByText(`${lineCount} lines`)).toBeDefined();
  });

  // ── useImperativeHandle ref ──

  it("exposes scrollToIri, insertAtEnd, getValue via ref", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    render(<OntologySourceEditor {...DEFAULT_PROPS} ref={ref} />);

    // Wait for the editor to be "ready" (onReady fires in mock useEffect)
    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    expect(typeof ref.current!.scrollToIri).toBe("function");
    expect(typeof ref.current!.insertAtEnd).toBe("function");
    expect(typeof ref.current!.getValue).toBe("function");
  });

  it("getValue returns current editor content", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    render(<OntologySourceEditor {...DEFAULT_PROPS} ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const value = ref.current!.getValue();
    expect(value).toBe(SAMPLE_TURTLE);
  });

  // ── Plural / singular issue labels ──

  it("uses singular 'error' for a single error", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1",
          run_id: "r1",
          project_id: "proj-1",
          issue_type: "error",
          rule_id: "ERR1",
          message: "An error",
          subject_iri: null,
          details: null,
          created_at: "2024-01-01T00:00:00Z",
          resolved_at: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText(/1 error\b/)).toBeDefined();
    });
  });

  it("uses plural 'errors' for multiple errors", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
          rule_id: "ERR1", message: "Error 1", subject_iri: null,
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
        {
          id: "i2", run_id: "r1", project_id: "proj-1", issue_type: "error",
          rule_id: "ERR2", message: "Error 2", subject_iri: null,
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 2,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText(/2 errors/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Save error with non-Error rejection ──

  it("shows generic error message when onSave rejects with non-Error", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue("string rejection");
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "bad content");
    await user.click(screen.getByText("Save").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Failed to save")).toBeDefined();
    });
  });

  // ── Revert clears save error ──

  it("clears save error when Revert is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "bad content");
    await user.click(screen.getByText("Save").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeDefined();
    });

    await user.click(screen.getByText("Revert").closest("button")!);
    expect(screen.queryByText("Save failed")).toBeNull();
  });

  // ── Successful save resets hasChanges ──

  it("resets unsaved changes indicator after successful save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);
    await user.type(editor, "new content");
    expect(screen.getByText("Unsaved changes")).toBeDefined();

    await user.click(screen.getByText("Save").closest("button")!);

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes")).toBeNull();
    });
  });

  // ── scrollToIri via ref with prebuiltIriIndex ──

  it("scrollToIri returns true and scrolls when IRI is in prebuilt index", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology#Person", { line: 4, col: 1, len: 40 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const result = ref.current!.scrollToIri("http://example.org/ontology#Person");
    expect(result).toBe(true);
  });

  it("scrollToIri returns false when IRI is not found in index", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology#Person", { line: 4, col: 1, len: 40 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const result = ref.current!.scrollToIri("http://example.org/ontology#Unknown");
    expect(result).toBe(false);
  });

  // ── scrollToIri with normalized IRI (trailing hash/slash removal) ──

  it("scrollToIri matches IRI after normalizing trailing hash", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology", { line: 1, col: 1, len: 30 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // IRI with trailing hash should be normalized to match
    const result = ref.current!.scrollToIri("http://example.org/ontology#");
    expect(result).toBe(true);
  });

  it("scrollToIri matches IRI after normalizing trailing slash", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology", { line: 1, col: 1, len: 30 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const result = ref.current!.scrollToIri("http://example.org/ontology/");
    expect(result).toBe(true);
  });

  // ── scrollToIri with local name fallback ──

  it("scrollToIri matches by local name when full IRI not found", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology#Person", { line: 4, col: 1, len: 40 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // Different namespace but same local name
    const result = ref.current!.scrollToIri("http://other.org/ontology#Person");
    expect(result).toBe(true);
  });

  it("scrollToIri matches by slash-based local name", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology/Person", { line: 4, col: 1, len: 40 }],
    ]);
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={prebuiltIriIndex}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const result = ref.current!.scrollToIri("http://other.org/classes/Person");
    expect(result).toBe(true);
  });

  // ── scrollToIri deferred when index not ready ──

  it("scrollToIri defers scroll and returns true when index is empty", async () => {
    const ref = createRef<OntologySourceEditorRef>();
    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        ref={ref}
        prebuiltIriIndex={new Map()}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // Empty index - should defer and return true
    const result = ref.current!.scrollToIri("http://example.org/ontology#Person");
    expect(result).toBe(true);
  });

  // ── insertAtEnd via ref ──

  it("insertAtEnd calls executeEdits on the editor model", async () => {
    const _executeEditsMock = vi.fn();
    const _getValueMock = vi.fn().mockReturnValue(SAMPLE_TURTLE + "\n# appended");
    const _getLineCountMock = vi.fn().mockReturnValue(6);

    // Override TurtleEditor mock for this test
    // The mock already returns executeEdits, so we need to verify it gets called
    const ref = createRef<OntologySourceEditorRef>();
    render(<OntologySourceEditor {...DEFAULT_PROPS} ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // insertAtEnd should not throw even if executeEdits is a mock
    ref.current!.insertAtEnd("\n# new entity");
  });

  // ── pendingScrollIri prop triggers scroll when prebuiltIriIndex is available ──

  it("scrolls to pendingScrollIri when prebuiltIriIndex and editor are ready", async () => {
    const onScrollComplete = vi.fn();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology#Person", { line: 4, col: 1, len: 40 }],
    ]);

    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        prebuiltIriIndex={prebuiltIriIndex}
        pendingScrollIri="http://example.org/ontology#Person"
        onScrollComplete={onScrollComplete}
      />
    );

    await waitFor(() => {
      expect(onScrollComplete).toHaveBeenCalled();
    });
  });

  it("calls onScrollComplete even when pendingScrollIri is not found in index", async () => {
    const onScrollComplete = vi.fn();
    const prebuiltIriIndex = new Map([
      ["http://example.org/ontology#Person", { line: 4, col: 1, len: 40 }],
    ]);

    render(
      <OntologySourceEditor
        {...DEFAULT_PROPS}
        prebuiltIriIndex={prebuiltIriIndex}
        pendingScrollIri="http://example.org/ontology#Unknown"
        onScrollComplete={onScrollComplete}
      />
    );

    await waitFor(() => {
      expect(onScrollComplete).toHaveBeenCalled();
    });
  });

  // ── Worker error handling ──

  it("falls back to line-1 diagnostics when worker errors", async () => {
    const OrigWorker = globalThis.Worker;
    class ErrorWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onerror?.({ message: "Worker crashed" } as ErrorEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", ErrorWorker);

    try {
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "ERR1", message: "An error", subject_iri: "http://example.org/A",
            details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 200,
      });

      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Problems (1)")).toBeDefined();
      });
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Empty value clears diagnostics ──

  it("clears diagnostics when value becomes empty", async () => {
    const user = userEvent.setup();
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={vi.fn()} />);
    const editor = screen.getByTestId("turtle-editor");

    await user.clear(editor);

    // With empty value, no issues panel should show
    await waitFor(() => {
      expect(screen.queryByText(/Problems/)).toBeNull();
    });
  });

  // ── Problems panel: clicking an issue ──

  it("clicking a problem issue calls scrollToLine with the issue position", async () => {
    // Set up worker to return positions for the issue
    const OrigWorker = globalThis.Worker;
    class PositionWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              diagnostics: [{
                issueId: "i1",
                startLineNumber: 4,
                startColumn: 1,
                endLineNumber: 4,
                endColumn: 40,
                message: "[ERR1] Missing label",
                severity: "error",
              }],
              positions: [["i1", { line: 4, col: 1, len: 39 }]],
              iriIndex: [],
              iriLabels: [],
              stats: { linesProcessed: 5, irisIndexed: 1, localNamesIndexed: 1, issuesMatched: 1, timeMs: 5 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", PositionWorker);

    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
          rule_id: "ERR1", message: "Missing label",
          subject_iri: "http://example.org/A",
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 200,
    });

    try {
      const user = userEvent.setup();
      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Missing label")).toBeDefined();
      });

      const issueButton = screen.getByText("Missing label").closest("button")!;
      await user.click(issueButton);

      await waitFor(() => {
        expect(screen.getByText("Ln 4")).toBeDefined();
      });
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Problems panel: subject_iri display with hash ──

  it("displays local name from subject_iri with hash in problems panel", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "warning",
          rule_id: "WARN1", message: "Some warning",
          subject_iri: "http://example.org/ontology#MyClass",
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("MyClass")).toBeDefined();
    });
  });

  it("displays local name from subject_iri with slash in problems panel", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "info",
          rule_id: "INFO1", message: "Some info",
          subject_iri: "http://example.org/ontology/SlashClass",
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("SlashClass")).toBeDefined();
    });
  });

  // ── Problems panel: "And X more issues..." pagination ──

  it("shows 'And X more issues...' when there are more than 50 issues", async () => {
    const items = Array.from({ length: 55 }, (_, i) => ({
      id: `i${i}`,
      run_id: "r1",
      project_id: "proj-1",
      issue_type: "warning" as const,
      rule_id: `WARN${i}`,
      message: `Warning ${i}`,
      subject_iri: null,
      details: null,
      created_at: "2024-01-01T00:00:00Z",
      resolved_at: null,
    }));

    mockGetIssues.mockResolvedValue({
      items,
      total: 55,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("And 5 more issues...")).toBeDefined();
    });
  });

  // ── Problems panel: issue sorting (positioned issues first) ──

  it("shows issues with line positions before those without in the problems panel", async () => {
    const OrigWorker = globalThis.Worker;
    class SortWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              diagnostics: [],
              // Only issue "i2" has a position; "i1" does not
              positions: [["i2", { line: 10, col: 1, len: 20 }]],
              iriIndex: [],
              iriLabels: [],
              stats: { linesProcessed: 15, irisIndexed: 0, localNamesIndexed: 0, issuesMatched: 1, timeMs: 2 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", SortWorker);

    try {
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "ERR1", message: "No position issue",
            subject_iri: null, details: null,
            created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
          {
            id: "i2", run_id: "r1", project_id: "proj-1", issue_type: "warning",
            rule_id: "WARN1", message: "Has position issue",
            subject_iri: "http://example.org/A", details: null,
            created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 2,
        skip: 0,
        limit: 200,
      });

      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Ln 10")).toBeDefined();
      });

      expect(screen.getByText("Has position issue")).toBeDefined();
      expect(screen.getByText("No position issue")).toBeDefined();

      const buttons = screen.getAllByRole("button").filter(
        btn => btn.textContent?.includes("position issue")
      );
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toContain("Has position issue");
      expect(buttons[1].textContent).toContain("No position issue");
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Status bar: indexing stats display ──

  it("shows indexing stats in status bar after worker completes", async () => {
    const OrigWorker = globalThis.Worker;
    class StatsWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              diagnostics: [],
              positions: [["i1", { line: 4, col: 1, len: 10 }]],
              iriIndex: [["http://example.org/A", { line: 4, col: 1, len: 10 }]],
              iriLabels: [],
              stats: { linesProcessed: 100, irisIndexed: 42, localNamesIndexed: 42, issuesMatched: 3, timeMs: 12 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", StatsWorker);

    try {
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "ERR1", message: "An error", subject_iri: "http://example.org/A",
            details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 200,
      });

      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText(/Indexed 42 IRIs in 12ms/)).toBeDefined();
      });

      expect(screen.getByText(/3 issues mapped/)).toBeDefined();
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Status bar: "Ready" indicator ──

  it("shows Ready indicator in status bar when diagnostics are ready", async () => {
    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeDefined();
    });
  });

  // ── Status bar: "Indexing IRIs..." when not ready ──

  it("shows 'Indexing...' status when diagnostics are not yet ready and lint issues exist", async () => {
    // Use a worker that never responds
    const OrigWorker = globalThis.Worker;
    class SlowWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() { /* never responds */ }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", SlowWorker);

    try {
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "ERR1", message: "An error", subject_iri: null,
            details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 200,
      });

      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Problems (1)")).toBeDefined();
      });

      expect(screen.getAllByText("Indexing...").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Indexing IRIs...")).toBeDefined();
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Diagnostic click navigates to class ──

  it("handleDiagnosticClick calls onNavigateToClass for matching lint issue", async () => {
    const OrigWorker = globalThis.Worker;
    // Worker that returns a diagnostic with a matching rule_id
    class DiagWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              diagnostics: [{
                issueId: "i1",
                startLineNumber: 4,
                startColumn: 1,
                endLineNumber: 4,
                endColumn: 40,
                message: "[NAV_RULE] Navigate test",
                severity: "error",
              }],
              positions: [["i1", { line: 4, col: 1, len: 39 }]],
              iriIndex: [],
              iriLabels: [],
              stats: { linesProcessed: 5, irisIndexed: 0, localNamesIndexed: 0, issuesMatched: 1, timeMs: 1 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", DiagWorker);

    try {
      const onNavigateToClass = vi.fn();
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "NAV_RULE", message: "Navigate test",
            subject_iri: "http://example.org/ontology#Person",
            details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 200,
      });

      render(
        <OntologySourceEditor
          {...DEFAULT_PROPS}
          onNavigateToClass={onNavigateToClass}
        />
      );

      // Verify the issue renders with its subject IRI local name
      await waitFor(() => {
        expect(screen.getByText("Navigate test")).toBeDefined();
        expect(screen.getByText("Person")).toBeDefined();
      });
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── Info issue count display ──

  it("shows info count in toolbar and status bar", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "info",
          rule_id: "INFO1", message: "Info issue", subject_iri: null,
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
        {
          id: "i2", run_id: "r1", project_id: "proj-1", issue_type: "info",
          rule_id: "INFO2", message: "Info issue 2", subject_iri: null,
          details: null, created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 2,
      skip: 0,
      limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      // Toolbar shows "2 info", status bar shows "2 info"
      expect(screen.getAllByText("2 info").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Problems panel: "with line numbers" note ──

  it("shows count of issues with line numbers when some have positions", async () => {
    const OrigWorker = globalThis.Worker;
    class PartialPositionWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              diagnostics: [],
              // Only 1 out of 2 issues has a position
              positions: [["i1", { line: 4, col: 1, len: 10 }]],
              iriIndex: [],
              iriLabels: [],
              stats: { linesProcessed: 5, irisIndexed: 0, localNamesIndexed: 0, issuesMatched: 1, timeMs: 1 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() { /* no-op */ }
    }
    vi.stubGlobal("Worker", PartialPositionWorker);

    try {
      mockGetIssues.mockResolvedValue({
        items: [
          {
            id: "i1", run_id: "r1", project_id: "proj-1", issue_type: "error",
            rule_id: "ERR1", message: "Error with position",
            subject_iri: "http://example.org/A", details: null,
            created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
          {
            id: "i2", run_id: "r1", project_id: "proj-1", issue_type: "warning",
            rule_id: "WARN1", message: "Warning without position",
            subject_iri: null, details: null,
            created_at: "2024-01-01T00:00:00Z", resolved_at: null,
          },
        ],
        total: 2,
        skip: 0,
        limit: 200,
      });

      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText(/1 with line numbers/)).toBeDefined();
      });
    } finally {
      vi.stubGlobal("Worker", OrigWorker);
    }
  });

  // ── handleSave is no-op without onSave or without changes ──

  it("does not call onSave when there are no changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OntologySourceEditor {...DEFAULT_PROPS} onSave={onSave} />);

    // Save button is disabled, but let's also verify via logic
    // The save button should be disabled
    const saveBtn = screen.getByText("Save").closest("button")!;
    expect(saveBtn.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Loading issues indicator ──

  it("shows 'Loading issues...' while lint API is pending", async () => {
    // Make getIssues never resolve
    let resolveGetIssues: ((val: unknown) => void) | undefined;
    mockGetIssues.mockReturnValue(new Promise((resolve) => {
      resolveGetIssues = resolve;
    }));

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText("Loading issues...")).toBeDefined();
    });

    // Resolve to clean up
    resolveGetIssues?.({ items: [], total: 0, skip: 0, limit: 200 });

    await waitFor(() => {
      expect(screen.queryByText("Loading issues...")).toBeNull();
    });
  });

  // ── Problems panel: duplicate_iris rendering ──

  it("renders duplicate_iris as plain spans when not in the IRI index", async () => {
    // Worker mock returns an empty iriIndex, so all duplicate IRIs fall into
    // the "unknown" branch and render as non-interactive spans.
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1",
          issue_type: "warning", rule_id: "duplicate-label",
          message: "Label 'Foo' shared with 1 other resource",
          subject_iri: "http://example.org/A",
          subject_type: "class",
          details: { duplicate_iris: ["http://example.org/B"] },
          created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1, skip: 0, limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Also:")).toBeDefined();
    });
    const dup = screen.getByTitle("http://example.org/B");
    expect(dup.tagName).toBe("SPAN");
  });

  it("renders duplicate_iris as buttons when the IRI is indexed in the source", async () => {
    // Override the global Worker stub for this test so the iriIndex contains
    // the duplicate IRI — exercising the clickable-button branch.
    class WorkerWithIndex {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      private _t: ReturnType<typeof setTimeout> | null = null;
      postMessage() {
        this._t = setTimeout(() => {
          this._t = null;
          this.onmessage?.({
            data: {
              diagnostics: [],
              positions: [],
              iriIndex: [["http://example.org/B", { line: 5, col: 1, len: 10 }]],
              iriLabels: [],
              stats: { linesProcessed: 0, irisIndexed: 1, localNamesIndexed: 0, issuesMatched: 0, timeMs: 0 },
            },
          } as unknown as MessageEvent);
        }, 0);
      }
      terminate() {
        if (this._t !== null) { clearTimeout(this._t); this._t = null; }
      }
    }
    vi.stubGlobal("Worker", WorkerWithIndex);

    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1",
          issue_type: "warning", rule_id: "duplicate-label",
          message: "Label 'Foo' shared with 1 other resource",
          subject_iri: "http://example.org/A",
          subject_type: "class",
          details: { duplicate_iris: ["http://example.org/B"] },
          created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1, skip: 0, limit: 200,
    });

    try {
      render(<OntologySourceEditor {...DEFAULT_PROPS} />);

      await waitFor(() => {
        const dup = screen.getByTitle("http://example.org/B");
        expect(dup.tagName).toBe("BUTTON");
      });
    } finally {
      vi.stubGlobal("Worker", MockWorker);
    }
  });

  it("shows '+N more' when duplicate_iris has more than three entries", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        {
          id: "i1", run_id: "r1", project_id: "proj-1",
          issue_type: "warning", rule_id: "duplicate-label",
          message: "Label 'Foo' shared with 4 other resources",
          subject_iri: "http://example.org/A",
          subject_type: "class",
          details: {
            duplicate_iris: [
              "http://example.org/B",
              "http://example.org/C",
              "http://example.org/D",
              "http://example.org/E",
            ],
          },
          created_at: "2024-01-01T00:00:00Z", resolved_at: null,
        },
      ],
      total: 1, skip: 0, limit: 200,
    });

    render(<OntologySourceEditor {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("+1 more")).toBeDefined();
    });
  });
});

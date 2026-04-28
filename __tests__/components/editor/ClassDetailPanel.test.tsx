import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Configurable mock state (tests can override before render) ──

const mockTriggerSave = vi.fn();
const mockFlushToGit = vi.fn().mockResolvedValue(true);
const mockDiscardDraft = vi.fn();
const mockClearRestoredDraft = vi.fn();
const mockEditStateRef = { current: null as Record<string, unknown> | null };

let autoSaveOverrides: Record<string, unknown> = {};

let editorModeOverrides: Record<string, unknown> = {};

// ── Mocks (must be before component import) ──

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassDetail: vi.fn(),
    updateClass: vi.fn(),
    searchEntities: vi.fn(),
  },
}));

vi.mock("@/lib/api/lint", () => ({
  lintApi: { getIssues: vi.fn() },
}));

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/hooks/useAutoSave", () => ({
  useAutoSave: () => ({
    saveStatus: "idle",
    saveError: null,
    validationError: null,
    isDirty: false,
    triggerSave: mockTriggerSave,
    flushToGit: mockFlushToGit,
    discardDraft: mockDiscardDraft,
    editStateRef: mockEditStateRef,
    restoredDraft: null,
    clearRestoredDraft: mockClearRestoredDraft,
    ...autoSaveOverrides,
  }),
}));

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ editorMode: "standard", ...editorModeOverrides }),
}));

// Stub child components
vi.mock("@/components/editor/LanguageFlag", () => ({
  LanguageFlag: () => null,
}));
vi.mock("@/components/editor/LanguagePicker", () => ({
  LanguagePicker: ({ value, onChange }: { value: string; onChange: (code: string) => void }) => (
    <select
      data-testid="lang-picker"
      aria-label="Language tag"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    >
      <option value="en">en</option>
      <option value="de">de</option>
      <option value="fr">fr</option>
    </select>
  ),
}));
vi.mock("@/components/editor/ParentClassPicker", () => ({
  ParentClassPicker: () => null,
}));
let capturedAnnotationRowProps: Array<Record<string, unknown>> = [];
vi.mock("@/components/editor/standard/AnnotationRow", () => ({
  AnnotationRow: (props: Record<string, unknown>) => {
    capturedAnnotationRowProps.push(props);
    return null;
  },
}));
let capturedInlineAnnotationAdderProps: Record<string, unknown> | null = null;
vi.mock("@/components/editor/standard/InlineAnnotationAdder", () => ({
  InlineAnnotationAdder: (props: Record<string, unknown>) => {
    capturedInlineAnnotationAdderProps = props;
    return null;
  },
}));
let capturedRelationshipSectionProps: Record<string, unknown> | null = null;
vi.mock("@/components/editor/standard/RelationshipSection", () => ({
  RelationshipSection: (props: Record<string, unknown>) => {
    capturedRelationshipSectionProps = props;
    return null;
  },
}));
let _autoSaveBarProps: Record<string, unknown> = {};
vi.mock("@/components/editor/AutoSaveAffordanceBar", () => ({
  AutoSaveAffordanceBar: (props: Record<string, unknown>) => {
    _autoSaveBarProps = props;
    return (
      <div data-testid="auto-save-bar">
        {typeof props.onCancel === "function" && (
          <button data-testid="cancel-edit" onClick={props.onCancel as () => void}>Cancel</button>
        )}
        {typeof props.onManualSave === "function" && (
          <button data-testid="manual-save" onClick={props.onManualSave as () => void}>Save</button>
        )}
      </div>
    );
  },
}));
vi.mock("@/components/editor/CrossReferencesPanel", () => ({
  CrossReferencesPanel: () => null,
}));
vi.mock("@/components/editor/SimilarConceptsPanel", () => ({
  SimilarConceptsPanel: () => null,
}));
vi.mock("@/components/editor/EntityHistoryTab", () => ({
  EntityHistoryTab: () => null,
}));

import { ClassDetailPanel, ensureTrailingEmpty } from "@/components/editor/ClassDetailPanel";
import { projectOntologyApi } from "@/lib/api/client";
import { lintApi } from "@/lib/api/lint";

// ── Helpers ──

const mockGetClassDetail = projectOntologyApi.getClassDetail as Mock;
const mockGetIssues = lintApi.getIssues as Mock;
const mockSearchEntities = projectOntologyApi.searchEntities as Mock;

function makeClassDetail(overrides: Record<string, unknown> = {}) {
  return {
    iri: "http://example.org/ontology#Person",
    labels: [{ value: "Person", lang: "en" }],
    comments: [{ value: "A human being", lang: "en" }],
    deprecated: false,
    parent_iris: ["http://example.org/ontology#Agent"],
    parent_labels: { "http://example.org/ontology#Agent": "Agent" },
    equivalent_iris: null,
    disjoint_iris: null,
    child_count: 5,
    instance_count: 42,
    is_defined: true,
    annotations: [],
    ...overrides,
  };
}

function makeLintIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-1",
    run_id: "run-1",
    project_id: "proj-1",
    issue_type: "warning" as const,
    rule_id: "MISSING_LABEL",
    message: "Class is missing an rdfs:label",
    subject_iri: "http://example.org/ontology#Person",
    details: null,
    created_at: "2024-01-01T00:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  projectId: "proj-1",
  classIri: "http://example.org/ontology#Person",
  accessToken: "test-token",
  branch: "main",
};

// ── Tests ──

describe("ClassDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClassDetail.mockResolvedValue(makeClassDetail());
    mockGetIssues.mockResolvedValue({ items: [] });
    mockSearchEntities.mockResolvedValue({ results: [] });
    autoSaveOverrides = {};
    editorModeOverrides = {};
    mockEditStateRef.current = null;
    mockFlushToGit.mockResolvedValue(true);
    capturedAnnotationRowProps = [];
    capturedInlineAnnotationAdderProps = null;
    capturedRelationshipSectionProps = null;
  });

  // ── Empty / placeholder state ──

  it("renders 'Select a class' placeholder when classIri is null", () => {
    render(<ClassDetailPanel projectId="proj-1" classIri={null} />);
    expect(
      screen.getByText("Select a class from the tree to view its details")
    ).toBeDefined();
  });

  // ── Loading state ──

  it("shows a loading spinner while fetching", () => {
    // Never resolve the promise so it stays in loading state
    mockGetClassDetail.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ClassDetailPanel {...DEFAULT_PROPS} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  // ── Error state ──

  it("shows error message when API call fails", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("Network failure"));
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeDefined();
    });
  });

  it("shows entity-type hint for 404 errors", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("Class not found"));
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Could not load .* as an OWL Class/)
      ).toBeDefined();
    });
  });

  it("suppresses 404 error when selectedNodeFallback matches classIri", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("Class not found"));
    const fallback = {
      label: "NewClass",
      iri: "http://example.org/ontology#Person",
    };
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} selectedNodeFallback={fallback} />
    );

    // Should show the fallback card instead of an error
    await waitFor(() => {
      expect(screen.getAllByText("NewClass").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Unsaved")).toBeDefined();
    });
  });

  // ── Successful render ──

  it("renders class detail with label and IRI", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    // IRI displayed
    expect(
      screen.getByText("http://example.org/ontology#Person")
    ).toBeDefined();
  });

  it("renders comments section", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("A human being")).toBeDefined();
    });
  });

  it("renders parent class link", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Agent")).toBeDefined();
    });
  });

  it("renders deprecated badge when class is deprecated", async () => {
    mockGetClassDetail.mockResolvedValue(makeClassDetail({ deprecated: true }));
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Deprecated")).toBeDefined();
    });
  });

  it("renders statistics", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeDefined(); // child_count
      expect(screen.getByText("subclasses")).toBeDefined();
      expect(screen.getByText("42")).toBeDefined(); // instance_count
    });
  });

  it("renders equivalent classes when present", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        equivalent_iris: ["http://example.org/ontology#Human"],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Equivalent Classes")).toBeDefined();
      expect(screen.getByText("Human")).toBeDefined();
    });
  });

  it("renders disjoint classes when present", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        disjoint_iris: ["http://example.org/ontology#NonPerson"],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Disjoint With")).toBeDefined();
      expect(screen.getByText("NonPerson")).toBeDefined();
    });
  });

  // ── API call verification ──

  it("calls getClassDetail with correct arguments", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockGetClassDetail).toHaveBeenCalledWith(
        "proj-1",
        "http://example.org/ontology#Person",
        "test-token",
        "main"
      );
    });
  });

  it("calls lintApi.getIssues with subject_iri filter", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockGetIssues).toHaveBeenCalledWith(
        "proj-1",
        "test-token",
        expect.objectContaining({
          subject_iri: "http://example.org/ontology#Person",
          limit: 50,
        })
      );
    });
  });

  // ── Lint issues ──

  it("shows lint issues for the class", async () => {
    mockGetIssues.mockResolvedValue({ items: [makeLintIssue()] });
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Health Issues (1)")).toBeDefined();
      expect(
        screen.getByText("Class is missing an rdfs:label")
      ).toBeDefined();
      expect(screen.getByText("MISSING_LABEL:")).toBeDefined();
    });
  });

  it("does not show lint section when no issues", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Health Issues")).toBeNull();
  });

  // ── Copy IRI ──

  it("renders Copy IRI button when onCopyIri is provided", async () => {
    const onCopyIri = vi.fn();
    render(<ClassDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy IRI")).toBeDefined();
    });
  });

  it("calls onCopyIri when Copy IRI button is clicked", async () => {
    const user = userEvent.setup();
    const onCopyIri = vi.fn();
    render(<ClassDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);

    await waitFor(() => {
      expect(screen.getByTitle("Copy IRI")).toBeDefined();
    });

    await user.click(screen.getByTitle("Copy IRI"));
    expect(onCopyIri).toHaveBeenCalledWith(
      "http://example.org/ontology#Person"
    );
  });

  // ── View in Source ──

  it("renders Source button when onNavigateToSource is provided", async () => {
    const onNavigateToSource = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToSource={onNavigateToSource}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Source")).toBeDefined();
    });
  });

  // ── Read-only mode (canEdit=false) ──

  it("does not show edit button when canEdit is false", async () => {
    render(<ClassDetailPanel {...DEFAULT_PROPS} canEdit={false} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Tree-node fallback for unsaved entities ──

  it("renders unsaved entity fallback with parent link", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const fallback = {
      label: "NewEntity",
      iri: "http://example.org/ontology#Person",
      parentIri: "http://example.org/ontology#Agent",
      parentLabel: "Agent",
    };
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} selectedNodeFallback={fallback} />
    );

    await waitFor(() => {
      expect(screen.getAllByText("NewEntity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Unsaved")).toBeDefined();
      expect(screen.getAllByText("Agent").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Returns null when no detail and no fallback ──

  it("shows error when classDetail 404s and fallback IRI doesn't match", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const fallback = {
      label: "Other",
      iri: "http://example.org/ontology#Other", // different IRI
    };
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} selectedNodeFallback={fallback} />
    );

    await waitFor(() => {
      // Should show error since fallback IRI doesn't match
      expect(screen.getByText(/Could not load .* as an OWL Class/)).toBeDefined();
    });
  });

  // ── Header actions slot ──

  it("renders headerActions when provided", async () => {
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        headerActions={<button data-testid="graph-btn">Graph</button>}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("graph-btn")).toBeDefined();
    });
  });

  // ── Annotations rendering ──

  it("renders definition annotation", async () => {
    const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: DEFINITION_IRI,
            property_label: "Definition",
            values: [{ value: "A rational animal", lang: "en" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("A rational animal")).toBeDefined();
      expect(screen.getByText("Definition")).toBeDefined();
    });
  });

  it("renders custom annotation properties", async () => {
    const PREF_LABEL_IRI =
      "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [{ value: "Human Person", lang: "en" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Human Person")).toBeDefined();
    });
  });

  // ── Refetch on refreshKey change ──

  it("re-fetches when refreshKey changes", async () => {
    const { rerender } = render(
      <ClassDetailPanel {...DEFAULT_PROPS} refreshKey={1} />
    );

    await waitFor(() => {
      expect(mockGetClassDetail).toHaveBeenCalledTimes(1);
    });

    rerender(<ClassDetailPanel {...DEFAULT_PROPS} refreshKey={2} />);

    await waitFor(() => {
      expect(mockGetClassDetail).toHaveBeenCalledTimes(2);
    });
  });

  // ── Edit mode entry ──

  it("auto-enters edit mode and renders inputs when onUpdateClass is provided", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInput = screen.getByDisplayValue("Person");
    expect(labelInput).not.toBeNull();
    expect(labelInput.tagName).toBe("INPUT");
  });

  // ── Label editing ──

  it("updates label value when typing in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Person")).not.toBeNull();
    });

    const labelInput = screen.getByDisplayValue("Person");
    await user.clear(labelInput);
    await user.type(labelInput, "Human");

    expect(screen.getByDisplayValue("Human")).not.toBeNull();
  });

  it("updates label language tag in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getAllByLabelText("Language tag").length).toBeGreaterThanOrEqual(1);
    });

    // Find the language picker (mocked as <select>)
    const langPickers = screen.getAllByLabelText("Language tag");
    await user.selectOptions(langPickers[0], "de");

    expect((langPickers[0] as HTMLSelectElement).value).toBe("de");
  });

  // ── Comment editing ──

  it("renders comment textareas in edit mode", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      // Comment value should appear in a textarea
      expect(screen.getByDisplayValue("A human being")).not.toBeNull();
    });
    const commentArea = screen.getByDisplayValue("A human being");
    expect(commentArea.tagName).toBe("TEXTAREA");
  });

  it("updates comment value when typing in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("A human being")).not.toBeNull();
    });

    const commentArea = screen.getByDisplayValue("A human being");
    await user.clear(commentArea);
    await user.type(commentArea, "A sentient being");

    expect(screen.getByDisplayValue("A sentient being")).not.toBeNull();
  });

  it("removes a comment when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("A human being")).not.toBeNull();
    });

    const removeBtn = screen.getByTitle("Remove comment");
    await user.click(removeBtn);

    // The comment should be removed; textarea with that value gone
    expect(screen.queryByDisplayValue("A human being")).toBeNull();
  });

  // ── Parent editing ──

  it("shows parent with remove button in edit mode", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByTitle("Remove parent")).not.toBeNull();
    });
    // Parent label visible
    expect(screen.getByText("Agent")).not.toBeNull();
  });

  it("removes parent when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByTitle("Remove parent")).not.toBeNull();
    });

    await user.click(screen.getByTitle("Remove parent"));

    // Parent "Agent" should be gone from the edit parent list
    // (the read-only IriLink "Agent" is gone since we're in edit mode)
    await waitFor(() => {
      expect(screen.queryByTitle("Remove parent")).toBeNull();
    });
  });

  it("shows Add parent button in edit mode and opens picker on click", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByText("Add parent")).not.toBeNull();
    });

    await user.click(screen.getByText("Add parent"));

    // ParentClassPicker is mocked to render null, but Add parent button should disappear
    // (replaced by the picker component)
    await waitFor(() => {
      expect(screen.queryByText("Add parent")).toBeNull();
    });
  });

  it("closes the parent picker when the user cancels", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Add parent")).not.toBeNull();
    });

    // Open the parent picker
    await user.click(screen.getByText("Add parent"));
    await waitFor(() => {
      expect(screen.queryByText("Add parent")).toBeNull();
    });

    // Cancel via the AutoSaveAffordanceBar stub
    await user.click(screen.getByTestId("cancel-edit"));

    // The picker should close — Add parent button reappears
    await waitFor(() => {
      expect(screen.getByText("Add parent")).not.toBeNull();
    });
  });

  // ── Save flow ──

  it("triggers save on label input blur", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Person")).not.toBeNull();
    });

    const labelInput = screen.getByDisplayValue("Person");
    await user.click(labelInput);
    await user.tab(); // blur

    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Cancel flow ──

  it("discards draft when cancel is invoked but stays in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();

    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Person")).not.toBeNull();
    });

    // Click the cancel button exposed by the AutoSaveAffordanceBar stub
    const cancelBtn = screen.getByTestId("cancel-edit");
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalled();
    });
    // Editor is always in edit mode — auto-save bar stays.
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
  });

  it("flushes pending draft to git on unmount", async () => {
    // The parent layout remounts the panel on selection change via a key
    // prop, so the panel's contract for "navigate away" is "unmount and let
    // the cleanup flush". This test exercises that contract directly.
    const onUpdateClass = vi.fn();

    const { unmount } = render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    unmount();

    expect(mockFlushToGit).toHaveBeenCalled();
  });

  // ── Multiple labels with remove ──

  it("shows remove button only when there are multiple labels", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        labels: [
          { value: "Person", lang: "en" },
          { value: "Personne", lang: "fr" },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const removeBtns = screen.getAllByTitle("Remove label");
      expect(removeBtns.length).toBe(2);
    });
  });

  it("removes a label when remove button is clicked with multiple labels", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        labels: [
          { value: "Person", lang: "en" },
          { value: "Personne", lang: "fr" },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Personne")).not.toBeNull();
    });

    const removeBtns = screen.getAllByTitle("Remove label");
    await user.click(removeBtns[1]); // Remove "Personne"

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Personne")).toBeNull();
    });
  });

  // ── No "Edit Item" affordance in editor context ──

  it("never renders an Edit Item button in editor context", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Definition in edit mode ──

  it("renders Definition section with annotation row in edit mode", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#definition",
            property_label: "Definition",
            values: [{ value: "A rational animal", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    // Definition section title should be visible
    await waitFor(() => {
      expect(screen.getByText("Definition")).not.toBeNull();
    });
  });

  // ── Non-Error object in catch ──

  it("shows generic error for non-Error exceptions", async () => {
    mockGetClassDetail.mockRejectedValue("string error");
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load class details")).not.toBeNull();
    });
  });

  // ── Empty labels fallback ──

  it("renders class with no labels using local name", async () => {
    mockGetClassDetail.mockResolvedValue(makeClassDetail({ labels: [] }));
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      // Should fall back to getLocalName which extracts "Person" from the IRI
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Annotations: custom property rendering in read mode ──

  it("renders multiple annotation groups in read mode", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            property_label: "Preferred Label",
            values: [{ value: "Human Person", lang: "en" }],
          },
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#altLabel",
            property_label: "Alternative Label",
            values: [{ value: "Homo sapiens", lang: "la" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Human Person")).not.toBeNull();
      expect(screen.getByText("Homo sapiens")).not.toBeNull();
    });
  });

  // ── No comments ──

  it("does not render comments section when comments array is empty", async () => {
    mockGetClassDetail.mockResolvedValue(makeClassDetail({ comments: [] }));
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    // The "Comment(s)" section title should not appear
    expect(screen.queryByText("Comment(s)")).toBeNull();
  });

  // ── No parents ──

  it("does not render parent section when parent_iris is empty", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({ parent_iris: [], parent_labels: {} })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    // There should be no "Parent(s)" section
    expect(screen.queryByText("Parent(s)")).toBeNull();
  });

  // ── Navigate to source callback ──

  it("calls onNavigateToSource when Source button is clicked", async () => {
    const user = userEvent.setup();
    const onNavigateToSource = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToSource={onNavigateToSource}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Source")).not.toBeNull();
    });

    await user.click(screen.getByText("Source"));
    expect(onNavigateToSource).toHaveBeenCalledWith(
      "http://example.org/ontology#Person"
    );
  });

  // ── Navigate to parent class ──

  it("calls onNavigateToClass when parent link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigateToClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToClass={onNavigateToClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Agent")).not.toBeNull();
    });

    await user.click(screen.getByText("Agent"));
    expect(onNavigateToClass).toHaveBeenCalledWith(
      "http://example.org/ontology#Agent"
    );
  });

  // ── instance_count null ──

  it("renders dash for null instance_count", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({ instance_count: null })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("—")).not.toBeNull();
    });
  });

  // ── Lint issues with different severities ──

  it("renders error-type lint issue", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        makeLintIssue({ issue_type: "error", rule_id: "INVALID_IRI", message: "Invalid IRI format" }),
      ],
    });
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Health Issues (1)")).not.toBeNull();
      expect(screen.getByText("INVALID_IRI:")).not.toBeNull();
      expect(screen.getByText("Invalid IRI format")).not.toBeNull();
    });
  });

  it("renders info-type lint issue", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        makeLintIssue({ issue_type: "info", rule_id: "SUGGESTION", message: "Consider adding more labels" }),
      ],
    });
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Health Issues (1)")).not.toBeNull();
      expect(screen.getByText("SUGGESTION:")).not.toBeNull();
    });
  });

  // ── Edit mode with empty labels (no labels from server) ──

  it("initializes edit mode with empty label placeholder when server has no labels", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(makeClassDetail({ labels: [] }));
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      // Should have an empty label input placeholder
      const inputs = screen.getAllByPlaceholderText("Label text");
      expect(inputs.length).toBeGreaterThanOrEqual(1);
      expect((inputs[0] as HTMLInputElement).value).toBe("");
    });
  });

  // ── Comment ghost row (trailing empty placeholder) ──

  it("shows ghost comment row with placeholder text in edit mode", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      // The comment "A human being" + a trailing empty ghost row
      const textareas = screen.getAllByRole("textbox").filter(
        (el) => el.tagName === "TEXTAREA"
      );
      // Should have at least 2: the real comment and ghost placeholder
      expect(textareas.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 404 error with IRI containing slash (no hash) ──

  it("extracts local name from slash-separated IRI on 404", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        classIri="http://example.org/ontology/Animal"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Animal/)).not.toBeNull();
      expect(screen.getByText(/Could not load .* as an OWL Class/)).not.toBeNull();
    });
  });

  // ── Edit mode with relationship annotations ──

  it("initializes edit mode with relationship annotations and regular annotations", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            property_label: "Preferred Label",
            values: [{ value: "Human Person", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    // The "Relationship(s)" section should appear in edit mode
    await waitFor(() => {
      expect(screen.getByText("Relationship(s)")).not.toBeNull();
    });
    // The regular annotation "Preferred Label" section should also appear
    expect(screen.getByText("Preferred Label")).not.toBeNull();
  });

  // ── Relationship section visible in read mode when targets exist ──

  it("renders relationship section in read mode when targets exist", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Relationship(s)")).not.toBeNull();
    });
  });

  // ── Edit mode adds Definition section even if not present in server data ──

  it("adds empty Definition section in edit mode when not in server data", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({ annotations: [] })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByText("Definition")).not.toBeNull();
    });
  });

  // ── Relationship section hidden in read mode when no targets ──

  it("does not render relationship section in read mode when no targets", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "", lang: "" }], // empty value
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Relationship(s)")).toBeNull();
  });

  // ── Annotations with empty values not rendered in read mode ──

  it("does not render annotation section with empty values array", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            property_label: "Preferred Label",
            values: [],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    // Empty values array means section should not render
    expect(screen.queryByText("Preferred Label")).toBeNull();
  });

  // ── Class with null annotations ──

  it("handles null annotations gracefully in read mode", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({ annotations: null })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    // Should not crash, statistics should still render
    expect(screen.getByText("5")).not.toBeNull();
  });

  // ── Relationship target label resolution via searchEntities ──

  it("resolves relationship target labels from class detail and search", async () => {
    const SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
    const targetIri = "http://example.org/ontology#Related";

    // First call is for the main class, subsequent calls for resolving targets
    mockGetClassDetail
      .mockResolvedValueOnce(
        makeClassDetail({
          annotations: [
            {
              property_iri: SEE_ALSO,
              property_label: "See Also",
              values: [{ value: targetIri, lang: "" }],
            },
          ],
        })
      )
      // Target class lookup fails (not a class)
      .mockRejectedValueOnce(new Error("Class not found"));

    // Search fallback resolves the label
    mockSearchEntities.mockResolvedValueOnce({
      results: [{ iri: targetIri, label: "Related Thing", entity_type: "individual" }],
    });

    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Relationship(s)")).not.toBeNull();
    });

    // The search should have been called to resolve the label
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalled();
    });
  });

  // ── Relationship target label resolution via getClassDetail success ──

  it("resolves relationship target labels from class detail endpoint", async () => {
    const SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
    const targetIri = "http://example.org/ontology#Related";

    mockGetClassDetail
      .mockResolvedValueOnce(
        makeClassDetail({
          annotations: [
            {
              property_iri: SEE_ALSO,
              property_label: "See Also",
              values: [{ value: targetIri, lang: "" }],
            },
          ],
        })
      )
      // Target class lookup succeeds
      .mockResolvedValueOnce({
        iri: targetIri,
        labels: [{ value: "Related Class", lang: "en" }],
        comments: [],
        deprecated: false,
        parent_iris: [],
        parent_labels: {},
        equivalent_iris: null,
        disjoint_iris: null,
        child_count: 0,
        instance_count: 0,
        is_defined: true,
        annotations: [],
      });

    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockGetClassDetail).toHaveBeenCalledTimes(2);
    });
  });

  // ── Edit mode with isDefinedBy relationship ──

  it("initializes edit mode with isDefinedBy relationship", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
            property_label: "Is Defined By",
            values: [{ value: "http://example.org/ontology", lang: "" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByText("Relationship(s)")).not.toBeNull();
    });
  });

  // ── Multiple lint issues ──

  it("renders multiple lint issues with correct count", async () => {
    mockGetIssues.mockResolvedValue({
      items: [
        makeLintIssue({ id: "issue-1", rule_id: "MISSING_LABEL", message: "Missing label" }),
        makeLintIssue({ id: "issue-2", rule_id: "MISSING_COMMENT", message: "Missing comment", issue_type: "info" as const }),
      ],
    });
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Health Issues (2)")).not.toBeNull();
      expect(screen.getByText("Missing label")).not.toBeNull();
      expect(screen.getByText("Missing comment")).not.toBeNull();
    });
  });

  // ── Edit mode comment language change ──

  it("updates comment language tag in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("A human being")).not.toBeNull();
    });

    // Find language pickers (mocked as <select>) — labels come first, then comments
    const langPickers = screen.getAllByLabelText("Language tag");
    expect(langPickers.length).toBeGreaterThanOrEqual(2);

    // The comment lang picker is after the label ones
    const commentLangPicker = langPickers[langPickers.length - 1];
    await user.selectOptions(commentLangPicker, "fr");

    expect((commentLangPicker as HTMLSelectElement).value).toBe("fr");
  });

  // ── Edit mode: definition section with existing values shows annotation rows ──

  it("renders definition values in edit mode with annotation rows", async () => {
    const onUpdateClass = vi.fn();
    const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: DEFINITION_IRI,
            property_label: "Definition",
            values: [
              { value: "A rational animal", lang: "en" },
              { value: "Un animal raisonnable", lang: "fr" },
            ],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    // Definition section should be visible with values in annotation rows (mocked to null but section should render)
    await waitFor(() => {
      expect(screen.getByText("Definition")).not.toBeNull();
    });
  });

  // ── Fallback card: unsaved entity without parent ──

  it("renders unsaved entity fallback without parent section when no parent", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const fallback = {
      label: "NewEntity",
      iri: "http://example.org/ontology#Person",
      // no parentIri
    };
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} selectedNodeFallback={fallback} />
    );

    await waitFor(() => {
      expect(screen.getAllByText("NewEntity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Unsaved")).not.toBeNull();
    });
    // No parent section
    expect(screen.queryByText("Parent(s)")).toBeNull();
    // Should show the warning about unsaved entity
    expect(screen.getByText(/has not been saved yet/)).not.toBeNull();
  });

  // ── Annotations with multiple known icons ──

  it("renders annotation with notation icon", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#notation",
            property_label: "Notation",
            values: [{ value: "P001", lang: "" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("P001")).not.toBeNull();
    });
  });

  // ── Annotations with unknown property IRI (falls back to FileText icon) ──

  it("renders unknown annotation property in read mode", async () => {
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://example.org/custom#note",
            property_label: "Custom Note",
            values: [{ value: "Some custom note", lang: "en" }],
          },
        ],
      })
    );
    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Some custom note")).not.toBeNull();
    });
  });

  // ── Returns null when classDetail is null and no matching fallback ──

  it("shows error when classDetail 404s and fallback IRI does not match", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const { container } = render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        selectedNodeFallback={{ label: "X", iri: "http://other/iri" }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Could not load .* as an OWL Class/)).not.toBeNull();
    });
    // Error state should be visible
    expect(container.querySelector(".border-red-200")).not.toBeNull();
  });

  // ── Manual save stays in edit mode when flushToGit fails ──

  it("stays in edit mode when flushDraftToGit flush fails", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    mockFlushToGit.mockResolvedValue(false);
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByTestId("manual-save")).not.toBeNull();
    });

    await user.click(screen.getByTestId("manual-save"));

    // Should remain in edit mode — Edit Item button should NOT be visible
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
      expect(mockFlushToGit).toHaveBeenCalled();
    });
    // Auto-save bar should still be visible (still editing)
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
  });

  // ── Cancel keeps the panel in edit mode ──

  it("stays in edit mode after cancel and discards the draft", async () => {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    const cancelBtn = screen.getByTestId("cancel-edit");
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalled();
    });
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
  });

  // ── Draft restoration auto-enter ──

  it("auto-enters edit mode when restoredDraft is available", async () => {
    autoSaveOverrides = {
      restoredDraft: {
        labels: [{ value: "Restored Label", lang: "en" }],
        comments: [{ value: "Restored Comment", lang: "en" }],
        parentIris: ["http://example.org/ontology#Agent"],
        parentLabels: { "http://example.org/ontology#Agent": "Agent" },
        annotations: [],
        relationships: [],
      },
    };
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
      expect(mockClearRestoredDraft).toHaveBeenCalled();
    });
  });

  // ── Draft restoration with empty labels ──

  it("auto-enters edit mode with empty label placeholder from restored draft", async () => {
    autoSaveOverrides = {
      restoredDraft: {
        labels: [],
        comments: [],
        parentIris: [],
        parentLabels: {},
        annotations: [],
        relationships: [],
      },
    };
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  // ── InlineAnnotationAdder onAdd adds to existing annotation ──

  it("InlineAnnotationAdder adds value to existing annotation property", async () => {
    const onUpdateClass = vi.fn();
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [{ value: "Existing Value", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedInlineAnnotationAdderProps).not.toBeNull();
    });

    const onAdd = capturedInlineAnnotationAdderProps!.onAdd as (propertyIri: string, value: string, lang: string) => void;
    // Add to existing annotation
    onAdd(PREF_LABEL_IRI, "New Value", "fr");

    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── InlineAnnotationAdder onAdd creates new annotation property ──

  it("InlineAnnotationAdder creates new annotation property when not existing", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({ annotations: [] })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedInlineAnnotationAdderProps).not.toBeNull();
    });

    const onAdd = capturedInlineAnnotationAdderProps!.onAdd as (propertyIri: string, value: string, lang: string) => void;
    onAdd("http://www.w3.org/2004/02/skos/core#example", "Example value", "en");

    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── RelationshipSection callbacks in edit mode ──

  it("passes relationship callbacks to RelationshipSection in edit mode", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedRelationshipSectionProps).not.toBeNull();
    });

    // Test addTarget
    const onAddTarget = capturedRelationshipSectionProps!.onAddTarget as (groupIdx: number, target: { iri: string; label: string }) => void;
    onAddTarget(0, { iri: "http://example.org/ontology#newRelated", label: "newRelated" });
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes removeRelationshipTarget via RelationshipSection", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedRelationshipSectionProps).not.toBeNull();
    });

    const onRemoveTarget = capturedRelationshipSectionProps!.onRemoveTarget as (groupIdx: number, targetIdx: number) => void;
    onRemoveTarget(0, 0);
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes changeRelationshipProperty via RelationshipSection", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedRelationshipSectionProps).not.toBeNull();
    });

    const onChangeProperty = capturedRelationshipSectionProps!.onChangeProperty as (groupIdx: number, newIri: string, newLabel: string) => void;
    onChangeProperty(0, "http://www.w3.org/2000/01/rdf-schema#isDefinedBy", "Defined By");
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes addRelationshipGroup via RelationshipSection", async () => {
    const onUpdateClass = vi.fn();
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedRelationshipSectionProps).not.toBeNull();
    });

    const groupsBefore = (capturedRelationshipSectionProps!.groups as unknown[]).length;
    const onAddGroup = capturedRelationshipSectionProps!.onAddGroup as () => void;
    onAddGroup();

    await waitFor(() => {
      const groupsAfter = (capturedRelationshipSectionProps!.groups as unknown[]).length;
      expect(groupsAfter).toBe(groupsBefore + 1);
    });
  });

  // ── RelationshipSection onSaveNeeded callback ──

  it("invokes triggerSave via RelationshipSection onSaveNeeded", async () => {
    const onUpdateClass = vi.fn();
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            property_label: "See Also",
            values: [{ value: "http://example.org/ontology#Related", lang: "" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedRelationshipSectionProps).not.toBeNull();
    });

    const onSaveNeeded = capturedRelationshipSectionProps!.onSaveNeeded as () => void;
    onSaveNeeded();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Annotation value update and remove callbacks in edit mode ──

  it("updates annotation value via AnnotationRow callback in edit mode", async () => {
    const onUpdateClass = vi.fn();
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [{ value: "Human", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const annRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === PREF_LABEL_IRI
      );
      expect(annRow).not.toBeNull();
    });

    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === PREF_LABEL_IRI
    );
    const onValueChange = annRow!.onValueChange as (v: string) => void;
    onValueChange("Updated Value");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === PREF_LABEL_IRI && p.value === "Updated Value"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  it("removes annotation value via AnnotationRow callback in edit mode", async () => {
    const onUpdateClass = vi.fn();
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [
              { value: "Label One", lang: "en" },
              { value: "Label Two", lang: "fr" },
            ],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const annRows = capturedAnnotationRowProps.filter(
        (p) => p.propertyIri === PREF_LABEL_IRI
      );
      expect(annRows.length).toBeGreaterThanOrEqual(1);
    });

    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === PREF_LABEL_IRI && typeof p.onRemove === "function"
    );
    expect(annRow).not.toBeNull();
    const onRemove = annRow!.onRemove as () => void;
    onRemove();

    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── Annotation definition update callback via AnnotationRow ──

  it("updates definition annotation via AnnotationRow callback", async () => {
    const onUpdateClass = vi.fn();
    const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: DEFINITION_IRI,
            property_label: "Definition",
            values: [{ value: "A rational animal", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const defRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === DEFINITION_IRI
      );
      expect(defRow).not.toBeNull();
    });

    const defRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === DEFINITION_IRI
    );
    const onValueChange = defRow!.onValueChange as (v: string) => void;
    onValueChange("Updated definition");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === DEFINITION_IRI && p.value === "Updated definition"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  // ── Definition AnnotationRow onBlur triggers save ──

  it("definition AnnotationRow onBlur triggers triggerSave", async () => {
    const onUpdateClass = vi.fn();
    const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: DEFINITION_IRI,
            property_label: "Definition",
            values: [{ value: "A rational animal", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const defRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === DEFINITION_IRI
      );
      expect(defRow).not.toBeNull();
    });

    const defRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === DEFINITION_IRI
    );
    const onBlur = defRow!.onBlur as () => void;
    onBlur();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Does not auto-enter edit mode when canEdit is false ──

  it("does not auto-enter edit mode when canEdit is false even with onUpdateClass", async () => {
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} canEdit={false} onUpdateClass={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByTestId("auto-save-bar")).toBeNull();
  });

  // ── Target label resolution: search fails gracefully ──

  it("handles target label resolution when both class and search fail", async () => {
    const SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
    const targetIri = "http://example.org/ontology#Orphan";

    mockGetClassDetail
      .mockResolvedValueOnce(
        makeClassDetail({
          annotations: [
            {
              property_iri: SEE_ALSO,
              property_label: "See Also",
              values: [{ value: targetIri, lang: "" }],
            },
          ],
        })
      )
      .mockRejectedValueOnce(new Error("Class not found"));

    // Search also fails
    mockSearchEntities.mockRejectedValueOnce(new Error("Search failed"));

    render(<ClassDetailPanel {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Relationship(s)")).not.toBeNull();
    });

    // Should not crash
    await waitFor(() => {
      expect(mockSearchEntities).toHaveBeenCalled();
    });
  });

  // ── Annotation language change callback ──

  it("updates annotation language via AnnotationRow callback", async () => {
    const onUpdateClass = vi.fn();
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [{ value: "Human", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const annRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === PREF_LABEL_IRI
      );
      expect(annRow).not.toBeNull();
    });

    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === PREF_LABEL_IRI
    );
    const onLangChange = annRow!.onLangChange as (l: string) => void;
    onLangChange("de");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === PREF_LABEL_IRI && p.lang === "de"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  // ── Definition remove callback ──

  it("removes definition value via AnnotationRow callback", async () => {
    const onUpdateClass = vi.fn();
    const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: DEFINITION_IRI,
            property_label: "Definition",
            values: [
              { value: "First def", lang: "en" },
              { value: "Second def", lang: "fr" },
            ],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const defRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === DEFINITION_IRI && typeof p.onRemove === "function"
      );
      expect(defRow).not.toBeNull();
    });

    const defRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === DEFINITION_IRI && typeof p.onRemove === "function"
    );
    const onRemove = defRow!.onRemove as () => void;
    onRemove();

    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── Annotation AnnotationRow onBlur triggers save ──

  it("annotation AnnotationRow onBlur triggers triggerSave", async () => {
    const onUpdateClass = vi.fn();
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockGetClassDetail.mockResolvedValue(
      makeClassDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            property_label: "Preferred Label",
            values: [{ value: "Human", lang: "en" }],
          },
        ],
      })
    );
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateClass={onUpdateClass}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      const annRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === PREF_LABEL_IRI
      );
      expect(annRow).not.toBeNull();
    });

    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === PREF_LABEL_IRI
    );
    const onBlur = annRow!.onBlur as () => void;
    onBlur();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Navigate to fallback parent ──

  it("calls onNavigateToClass when clicking parent in fallback card", async () => {
    const user = userEvent.setup();
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const onNavigateToClass = vi.fn();
    const fallback = {
      label: "NewEntity",
      iri: "http://example.org/ontology#Person",
      parentIri: "http://example.org/ontology#Agent",
      parentLabel: "Agent",
    };
    render(
      <ClassDetailPanel
        {...DEFAULT_PROPS}
        selectedNodeFallback={fallback}
        onNavigateToClass={onNavigateToClass}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Agent").length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText("Agent")[0]);
    expect(onNavigateToClass).toHaveBeenCalledWith("http://example.org/ontology#Agent");
  });

  // ── Returns null when no classDetail and no fallback matching ──

  it("shows fallback card when classDetail is null and matching fallback provided", async () => {
    mockGetClassDetail.mockRejectedValue(new Error("404 Class not found"));
    const fallback = {
      label: "NewEntity",
      iri: "http://example.org/ontology#Person",
    };
    render(
      <ClassDetailPanel {...DEFAULT_PROPS} selectedNodeFallback={fallback} />
    );

    await waitFor(() => {
      expect(screen.getByText(/has not been saved yet/)).not.toBeNull();
    });
  });
});

// ── ensureTrailingEmpty helper unit tests ──

describe("ensureTrailingEmpty", () => {
  it("appends empty row to empty array", () => {
    const result = ensureTrailingEmpty([]);
    expect(result).toEqual([{ value: "", lang: "en" }]);
  });

  it("appends empty row when last item has non-empty value", () => {
    const result = ensureTrailingEmpty([{ value: "hello", lang: "en" }]);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ value: "", lang: "en" });
  });

  it("does not append when last item is already empty", () => {
    const input = [
      { value: "hello", lang: "en" },
      { value: "", lang: "en" },
    ];
    const result = ensureTrailingEmpty(input);
    expect(result).toHaveLength(2);
  });

  it("does not append when last item is whitespace-only", () => {
    const input = [{ value: "  ", lang: "en" }];
    const result = ensureTrailingEmpty(input);
    expect(result).toHaveLength(1);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Configurable mock state (tests can override before render) ──

const mockExtractIndividualDetail = vi.fn();
vi.mock("@/lib/ontology/entityDetailExtractors", () => ({
  extractIndividualDetail: (...args: unknown[]) => mockExtractIndividualDetail(...args),
}));

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const mockTriggerSave = vi.fn();
const mockFlushToGit = vi.fn().mockResolvedValue(true);
const mockDiscardDraft = vi.fn();
const mockClearRestoredDraft = vi.fn();

let autoSaveOverrides: Record<string, unknown> = {};
let editorModeOverrides: Record<string, unknown> = {};

vi.mock("@/lib/hooks/useEntityAutoSave", () => ({
  useEntityAutoSave: () => ({
    saveStatus: "idle",
    saveError: null,
    validationError: null,
    isDirty: false,
    triggerSave: mockTriggerSave,
    flushToGit: mockFlushToGit,
    discardDraft: mockDiscardDraft,
    editStateRef: { current: null },
    restoredDraft: null,
    clearRestoredDraft: mockClearRestoredDraft,
    ...autoSaveOverrides,
  }),
}));

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ editorMode: "standard", ...editorModeOverrides }),
}));

vi.mock("@/lib/hooks/useIriLabels", () => ({
  useIriLabels: () => ({}),
}));

// Stub child components - capture props for callback testing
vi.mock("@/components/editor/LanguageFlag", () => ({
  LanguageFlag: () => null,
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

let capturedPropertyAssertionProps: Array<Record<string, unknown>> = [];
vi.mock("@/components/editor/standard/PropertyAssertionSection", () => ({
  PropertyAssertionSection: (props: Record<string, unknown>) => {
    capturedPropertyAssertionProps.push(props);
    return null;
  },
}));

let capturedAutoSaveBarProps: Record<string, unknown> | null = null;
vi.mock("@/components/editor/AutoSaveAffordanceBar", () => ({
  AutoSaveAffordanceBar: (props: Record<string, unknown>) => {
    capturedAutoSaveBarProps = props;
    return <div data-testid="auto-save-bar">AutoSaveBar</div>;
  },
}));

import { IndividualDetailPanel } from "@/components/editor/IndividualDetailPanel";

// ── Helpers ──

function makeIndividualDetail(overrides: Record<string, unknown> = {}) {
  return {
    labels: [{ value: "John Doe", lang: "en" }],
    comments: [{ value: "A sample person", lang: "en" }],
    definitions: [{ value: "An individual representing John Doe", lang: "en" }],
    annotations: [],
    typeIris: ["http://example.org/ontology#Person"],
    sameAsIris: [],
    differentFromIris: [],
    deprecated: false,
    objectPropertyAssertions: [],
    dataPropertyAssertions: [],
    seeAlsoIris: [],
    isDefinedByIris: [],
    ...overrides,
  };
}

const SAMPLE_SOURCE = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix : <http://example.org/ontology#> .
:JohnDoe a owl:NamedIndividual , :Person ;
  rdfs:label "John Doe"@en ;
  rdfs:comment "A sample person"@en .
`;

const DEFAULT_PROPS = {
  projectId: "proj-1",
  individualIri: "http://example.org/ontology#JohnDoe",
  sourceContent: SAMPLE_SOURCE,
  canEdit: false,
  accessToken: "test-token",
  branch: "main",
};

// ── Tests ──

describe("IndividualDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlushToGit.mockResolvedValue(true);
    autoSaveOverrides = {};
    editorModeOverrides = {};
    capturedAnnotationRowProps = [];
    capturedRelationshipSectionProps = null;
    capturedPropertyAssertionProps = [];
    capturedAutoSaveBarProps = null;
    capturedInlineAnnotationAdderProps = null;
    mockExtractIndividualDetail.mockReturnValue(makeIndividualDetail());
  });

  // ── Empty / placeholder state ──

  it("renders 'Select an individual' placeholder when individualIri is null", () => {
    render(
      <IndividualDetailPanel
        projectId="proj-1"
        individualIri={null}
        sourceContent=""
        canEdit={false}
      />
    );
    expect(
      screen.getByText("Select an individual to view its details")
    ).toBeDefined();
  });

  // ── Loading state ──

  it("shows a loading spinner when sourceContent is empty", () => {
    const { container } = render(
      <IndividualDetailPanel
        projectId="proj-1"
        individualIri="http://example.org/ontology#JohnDoe"
        sourceContent=""
        canEdit={false}
      />
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  // ── Not found state ──

  it("shows not-found message when extractIndividualDetail returns null", () => {
    mockExtractIndividualDetail.mockReturnValue(null);
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("Could not find this individual in the ontology source.")
    ).toBeDefined();
  });

  it("shows individual IRI in not-found state header", () => {
    mockExtractIndividualDetail.mockReturnValue(null);
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("http://example.org/ontology#JohnDoe")
    ).toBeDefined();
  });

  it("shows local name in not-found state header", () => {
    mockExtractIndividualDetail.mockReturnValue(null);
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("JohnDoe")).toBeDefined();
  });

  // ── Successful render ──

  it("renders individual label and IRI", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("http://example.org/ontology#JohnDoe")
    ).toBeDefined();
  });

  it("renders Individual type badge", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Individual")).toBeDefined();
  });

  it("renders deprecated badge when individual is deprecated", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ deprecated: true })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Deprecated")).toBeDefined();
  });

  it("renders comments section", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("A sample person")).toBeDefined();
  });

  it("renders definitions section", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("An individual representing John Doe")
    ).toBeDefined();
  });

  it("renders types section", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Type(s)")).toBeDefined();
  });

  it("renders same-as section when present", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        sameAsIris: ["http://example.org/ontology#JDoe"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Same As")).toBeDefined();
  });

  it("renders different-from section when present", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        differentFromIris: ["http://example.org/ontology#JaneDoe"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Different From")).toBeDefined();
  });

  it("renders object property assertions when present (read-only)", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasParent",
            targetIri: "http://example.org/ontology#JamesDoe",
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Object Properties")).toBeDefined();
  });

  it("renders data property assertions when present (read-only)", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasAge",
            value: "42",
            datatype: "http://www.w3.org/2001/XMLSchema#integer",
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Data Properties")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("integer")).toBeDefined();
  });

  it("renders annotations when present", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "J. Doe", lang: "en" }],
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("J. Doe")).toBeDefined();
  });

  it("does not render empty optional sections", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        typeIris: [],
        sameAsIris: [],
        differentFromIris: [],
        objectPropertyAssertions: [],
        dataPropertyAssertions: [],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Type(s)")).toBeNull();
    expect(screen.queryByText("Same As")).toBeNull();
    expect(screen.queryByText("Different From")).toBeNull();
    expect(screen.queryByText("Object Properties")).toBeNull();
    expect(screen.queryByText("Data Properties")).toBeNull();
  });

  // ── Copy IRI ──

  it("renders Copy IRI button when onCopyIri is provided", () => {
    const onCopyIri = vi.fn();
    render(<IndividualDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);
    expect(screen.getByTitle("Copy IRI")).toBeDefined();
  });

  it("calls onCopyIri when Copy IRI button is clicked", async () => {
    const user = userEvent.setup();
    const onCopyIri = vi.fn();
    render(<IndividualDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);
    await user.click(screen.getByTitle("Copy IRI"));
    expect(onCopyIri).toHaveBeenCalledWith(
      "http://example.org/ontology#JohnDoe"
    );
  });

  // ── Read-only mode (canEdit=false) ──

  it("does not show edit button when canEdit is false", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Edit mode (canEdit=true) ──

  it("auto-enters edit mode when canEdit is true and onUpdateIndividual provided", async () => {
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  it("enters edit mode when Edit Item is clicked", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByTestId("auto-save-bar")).toBeDefined();
  });

  // ── API call verification ──

  it("calls extractIndividualDetail with sourceContent and individualIri", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(mockExtractIndividualDetail).toHaveBeenCalledWith(
      SAMPLE_SOURCE,
      "http://example.org/ontology#JohnDoe"
    );
  });

  it("re-parses when refreshKey changes", () => {
    const { rerender } = render(
      <IndividualDetailPanel {...DEFAULT_PROPS} refreshKey={1} />
    );
    expect(mockExtractIndividualDetail).toHaveBeenCalledTimes(1);

    rerender(<IndividualDetailPanel {...DEFAULT_PROPS} refreshKey={2} />);
    expect(mockExtractIndividualDetail).toHaveBeenCalledTimes(2);
  });

  // ── Falls back to local name when no labels ──

  it("renders local name when individual has no labels", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ labels: [] })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getAllByText("JohnDoe").length).toBeGreaterThanOrEqual(1);
  });

  // ── Relationships section ──

  it("renders relationships section when seeAlsoIris present", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Relationships")).toBeDefined();
  });

  it("does not render relationships section when no seeAlso or isDefinedBy", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: [],
        isDefinedByIris: [],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Relationships")).toBeNull();
  });

  // ── Edit mode: label editing ──

  it("renders editable label inputs in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInputs = screen.getAllByPlaceholderText("Label text");
    expect(labelInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders editable comment section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Comment(s)")).not.toBeNull();
  });

  it("renders editable definition section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Definition")).not.toBeNull();
  });

  it("renders types section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Type(s)")).not.toBeNull();
  });

  it("renders same-as section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Same As")).not.toBeNull();
  });

  it("renders different-from section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Different From")).not.toBeNull();
  });

  it("renders object properties section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Object Properties")).not.toBeNull();
  });

  it("renders data properties section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Data Properties")).not.toBeNull();
  });

  it("renders annotations section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Annotations")).not.toBeNull();
  });

  it("renders relationships section in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Relationships")).not.toBeNull();
  });

  // ── Label input interaction ──

  it("allows typing in a label input in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInput = screen.getAllByPlaceholderText("Label text")[0];
    await user.clear(labelInput);
    await user.type(labelInput, "Jane Doe");
    expect((labelInput as HTMLInputElement).value).toBe("Jane Doe");
  });

  // ── Cancel edit mode ──

  it("shows auto-save bar when in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
  });

  // ── Auto-enter edit mode in editor context ──

  it("auto-enters edit mode when onUpdateIndividual is provided (editor context)", async () => {
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  // ── Draft restoration ──

  it("auto-enters edit mode when restoredDraft is available", async () => {
    autoSaveOverrides = {
      restoredDraft: {
        entityType: "individual",
        labels: [{ value: "Restored Name", lang: "en" }],
        comments: [{ value: "Restored Comment", lang: "en" }],
        definitions: [],
        typeIris: ["http://example.org/ontology#Person"],
        sameAsIris: [],
        differentFromIris: [],
        objectPropertyAssertions: [],
        dataPropertyAssertions: [],
        annotations: [],
        relationships: [],
        deprecated: false,
        updatedAt: Date.now(),
      },
    };
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(mockClearRestoredDraft).toHaveBeenCalled();
  });

  // ── flushToGit on IRI change ──

  it("calls flushToGit when individualIri changes", async () => {
    const { rerender } = render(
      <IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />
    );
    rerender(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        individualIri="http://example.org/ontology#JaneDoe"
        canEdit={false}
      />
    );
    await waitFor(() => {
      expect(mockFlushToGit).toHaveBeenCalled();
    });
  });

  // ── Does not auto-enter edit mode when canEdit is false ──

  it("does not auto-enter edit mode when canEdit is false even with onUpdateIndividual", () => {
    render(
      <IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} onUpdateIndividual={vi.fn()} />
    );
    expect(screen.queryByTestId("auto-save-bar")).toBeNull();
  });

  // ── Does not show edit button without onUpdateIndividual ──

  it("does not show edit button when canEdit is true but onUpdateIndividual is not provided", () => {
    render(
      <IndividualDetailPanel {...DEFAULT_PROPS} canEdit={true} />
    );
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Language tag input in edit mode ──

  it("renders language tag inputs in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    const { container } = render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const langInputs = container.querySelectorAll('input[title="Language tag"]');
    expect(langInputs.length).toBeGreaterThanOrEqual(1);
  });

  // ── triggerSave on blur of label input ──

  it("calls triggerSave on blur of label input", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInput = screen.getAllByPlaceholderText("Label text")[0];
    await user.click(labelInput);
    await user.tab();
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── isDefinedBy in relationships ──

  it("renders relationships section when isDefinedByIris present", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        isDefinedByIris: ["http://example.org/ontology"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Relationships")).not.toBeNull();
  });

  // ── Does not enter edit mode on draft restoration when entityType mismatches ──

  it("does not restore draft when entityType does not match individual", async () => {
    autoSaveOverrides = {
      restoredDraft: {
        entityType: "class",
        labels: [{ value: "Wrong type", lang: "en" }],
        updatedAt: Date.now(),
      },
    };
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    // Edit mode auto-enters (editor context), but the wrong-type draft should not be applied
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // The "Wrong type" label from the class draft should not appear
    expect(screen.queryByDisplayValue("Wrong type")).toBeNull();
  });

  // ── Multiple labels in read-only ──

  it("renders multiple labels in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        labels: [
          { value: "John Doe", lang: "en" },
          { value: "Jean Dupont", lang: "fr" },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Jean Dupont")).not.toBeNull();
  });

  // ── Object property assertion navigation target ──

  it("renders object property assertion with target in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasParent",
            targetIri: "http://example.org/ontology#JamesDoe",
          },
        ],
      })
    );
    const onNavigate = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToEntity={onNavigate}
      />
    );
    expect(screen.getByText("Object Properties")).not.toBeNull();
    expect(screen.getByText("JamesDoe")).not.toBeNull();
  });

  // ── Data property assertion with language ──

  it("renders data property assertion with datatype in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasName",
            value: "John",
            lang: "en",
            datatype: "http://www.w3.org/2001/XMLSchema#string",
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Data Properties")).not.toBeNull();
    expect(screen.getByText("John")).not.toBeNull();
    expect(screen.getByText("string")).not.toBeNull();
  });

  // ── Remove label button in edit mode ──

  it("shows remove button when multiple labels exist in edit mode", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        labels: [
          { value: "John Doe", lang: "en" },
          { value: "Jean Dupont", lang: "fr" },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    const { container } = render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const removeButtons = container.querySelectorAll('button[title="Remove"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Language tag editing in edit mode ──

  it("allows editing language tag input", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    const { container } = render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const langInput = container.querySelector('input[title="Language tag"]') as HTMLInputElement;
    expect(langInput).not.toBeNull();
    await user.clear(langInput);
    await user.type(langInput, "fr");
    expect(langInput.value).toBe("fr");
  });

  // ── Edit mode with no initial comments ──

  it("renders empty comment placeholder in edit mode when no comments", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ comments: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Comment(s)")).not.toBeNull();
  });

  // ── Edit mode with no initial definitions ──

  it("renders empty definition placeholder in edit mode when no definitions", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ definitions: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Definition")).not.toBeNull();
  });

  // ── Edit mode with empty types ──

  it("renders types search in edit mode even when empty", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ typeIris: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Type(s)")).not.toBeNull();
  });

  // ── Edit mode with empty sameAs ──

  it("renders same-as search in edit mode even when empty", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ sameAsIris: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Same As")).not.toBeNull();
  });

  // ── Edit mode with empty differentFrom ──

  it("renders different-from search in edit mode even when empty", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ differentFromIris: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Different From")).not.toBeNull();
  });

  // ── Navigate to entity callback ──

  it("calls onNavigateToEntity when type IRI link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToEntity={onNavigate}
      />
    );
    const personLink = screen.getByText("Person");
    await user.click(personLink);
    expect(onNavigate).toHaveBeenCalledWith(
      "http://example.org/ontology#Person"
    );
  });

  // ── Multiple comments in read-only ──

  it("renders multiple comments in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        comments: [
          { value: "First comment", lang: "en" },
          { value: "Second comment", lang: "fr" },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("First comment")).not.toBeNull();
    expect(screen.getByText("Second comment")).not.toBeNull();
  });

  // ── Multiple definitions in read-only ──

  it("renders multiple definitions in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        definitions: [
          { value: "Def one", lang: "en" },
          { value: "Def two", lang: "fr" },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Def one")).not.toBeNull();
    expect(screen.getByText("Def two")).not.toBeNull();
  });

  // ── Empty labels does not render labels section in read-only ──

  it("does not render labels section in read-only when no labels", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ labels: [] })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Label(s)")).toBeNull();
  });

  // ── Empty comments does not render comments section in read-only ──

  it("does not render comments section in read-only when no comments", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ comments: [] })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Comment(s)")).toBeNull();
  });

  // ── Empty definitions does not render definitions section in read-only ──

  it("does not render definitions section in read-only when no definitions", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ definitions: [] })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Definition")).toBeNull();
  });

  // ── Object property assertion navigation ──

  it("calls onNavigateToEntity when clicking object property target", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasParent",
            targetIri: "http://example.org/ontology#JamesDoe",
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToEntity={onNavigate}
      />
    );
    await user.click(screen.getByText("JamesDoe"));
    expect(onNavigate).toHaveBeenCalledWith(
      "http://example.org/ontology#JamesDoe"
    );
  });

  // ── Data property assertion without datatype ──

  it("renders data property assertion without datatype badge when no datatype", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasNote",
            value: "A note",
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("A note")).not.toBeNull();
  });

  // ── sameAs links in read-only ──

  it("renders sameAs IRI links in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        sameAsIris: ["http://example.org/ontology#JDoe"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("JDoe")).not.toBeNull();
  });

  // ── differentFrom links in read-only ──

  it("renders differentFrom IRI links in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        differentFromIris: ["http://example.org/ontology#JaneDoe"],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("JaneDoe")).not.toBeNull();
  });

  // ── Cancel edit mode via AutoSaveAffordanceBar ──

  it("invokes cancelEditMode via AutoSaveAffordanceBar onCancel", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onCancel = capturedAutoSaveBarProps!.onCancel as () => void;
    onCancel();
    expect(mockDiscardDraft).toHaveBeenCalled();
  });

  // ── Manual save via AutoSaveAffordanceBar ──

  it("invokes saveAndExitEditMode via AutoSaveAffordanceBar onManualSave", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onManualSave = capturedAutoSaveBarProps!.onManualSave as () => Promise<void>;
    await onManualSave();
    expect(mockTriggerSave).toHaveBeenCalled();
    expect(mockFlushToGit).toHaveBeenCalled();
  });

  // ── Retry via AutoSaveAffordanceBar ──

  it("invokes flushToGit via AutoSaveAffordanceBar onRetry", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onRetry = capturedAutoSaveBarProps!.onRetry as () => void;
    onRetry();
    expect(mockFlushToGit).toHaveBeenCalled();
  });

  // ── AnnotationRow callbacks for comments ──

  it("passes comment callbacks to AnnotationRow", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const commentRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment"
    );
    expect(commentRow).not.toBeNull();
    const onValueChange = commentRow!.onValueChange as (v: string) => void;
    onValueChange("Updated comment");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment" && p.value === "Updated comment"
      );
      expect(updatedRow).toBeDefined();
    });

    const onLangChange = commentRow!.onLangChange as (l: string) => void;
    onLangChange("fr");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment" && p.lang === "fr"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  // ── AnnotationRow callbacks for definitions ──

  it("passes definition callbacks to AnnotationRow", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const defRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#definition"
    );
    expect(defRow).not.toBeNull();
    const onValueChange = defRow!.onValueChange as (v: string) => void;
    onValueChange("Updated definition");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#definition" && p.value === "Updated definition"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  // ── AnnotationRow onBlur triggers save ──

  it("AnnotationRow onBlur triggers triggerSave", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const commentRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment"
    );
    expect(commentRow).not.toBeNull();
    const onBlur = commentRow!.onBlur as () => void;
    onBlur();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── AnnotationRow onRemove for comments ──

  it("passes onRemove to AnnotationRow for non-last comment rows", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        comments: [
          { value: "First comment", lang: "en" },
          { value: "Second comment", lang: "fr" },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const commentRows = capturedAnnotationRowProps.filter(
      (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment"
    );
    const firstCommentRow = commentRows[0];
    expect(firstCommentRow).toBeDefined();
    expect(firstCommentRow!.onRemove).toBeDefined();
    const onRemove = firstCommentRow!.onRemove as () => void;
    onRemove();
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── AnnotationRow onRemove for definitions ──

  it("passes onRemove to AnnotationRow for non-last definition rows", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        definitions: [
          { value: "First def", lang: "en" },
          { value: "Second def", lang: "fr" },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const defRows = capturedAnnotationRowProps.filter(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#definition"
    );
    const firstDefRow = defRows[0];
    expect(firstDefRow).toBeDefined();
    expect(firstDefRow!.onRemove).toBeDefined();
    const onRemoveDef = firstDefRow!.onRemove as () => void;
    onRemoveDef();
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── PropertyAssertionSection callbacks ──

  it("passes onAdd callback to PropertyAssertionSection for object properties", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const objectSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "object"
    );
    expect(objectSection).not.toBeNull();
    const onAdd = objectSection!.onAdd as (a: Record<string, unknown>) => void;
    onAdd({ propertyIri: "http://example.org/ontology#knows", targetIri: "http://example.org/ontology#JaneDoe" });
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("passes onRemove callback to PropertyAssertionSection for object properties", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasParent",
            targetIri: "http://example.org/ontology#JamesDoe",
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const objectSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "object"
    );
    expect(objectSection).not.toBeNull();
    const onRemove = objectSection!.onRemove as (idx: number) => void;
    onRemove(0);
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("passes onAdd callback to PropertyAssertionSection for data properties", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const dataSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "data"
    );
    expect(dataSection).not.toBeNull();
    const onAdd = dataSection!.onAdd as (a: Record<string, unknown>) => void;
    onAdd({ propertyIri: "http://example.org/ontology#hasAge", value: "30" });
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("passes onRemove callback to PropertyAssertionSection for data properties", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasAge",
            value: "42",
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const dataSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "data"
    );
    expect(dataSection).not.toBeNull();
    const onRemove = dataSection!.onRemove as (idx: number) => void;
    onRemove(0);
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── RelationshipSection callbacks ──

  it("passes relationship callbacks to RelationshipSection in edit mode", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    const onAddTarget = capturedRelationshipSectionProps!.onAddTarget as (groupIdx: number, target: { iri: string; label: string }) => void;
    onAddTarget(0, { iri: "http://example.org/ontology#newRelated", label: "newRelated" });
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes removeRelationshipTarget via RelationshipSection", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    const onRemoveTarget = capturedRelationshipSectionProps!.onRemoveTarget as (groupIdx: number, targetIdx: number) => void;
    onRemoveTarget(0, 0);
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes changeRelationshipProperty via RelationshipSection", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    const onChangeProperty = capturedRelationshipSectionProps!.onChangeProperty as (groupIdx: number, newIri: string, newLabel: string) => void;
    onChangeProperty(0, "http://www.w3.org/2000/01/rdf-schema#isDefinedBy", "Defined By");
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes addRelationshipGroup via RelationshipSection", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    const groupsBefore = (capturedRelationshipSectionProps!.groups as unknown[]).length;
    const onAddGroup = capturedRelationshipSectionProps!.onAddGroup as () => void;
    onAddGroup();

    await waitFor(() => {
      const groupsAfter = (capturedRelationshipSectionProps!.groups as unknown[]).length;
      expect(groupsAfter).toBe(groupsBefore + 1);
    });
  });

  // ── Custom annotation editing callbacks ──

  it("invokes updateAnnotationValue for custom annotations in edit mode", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "J. Doe", lang: "en" }],
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel"
    );
    expect(annRow).not.toBeNull();
    const onValueChange = annRow!.onValueChange as (v: string) => void;
    onValueChange("Updated Pref Label");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel" && p.value === "Updated Pref Label"
      );
      expect(updatedRow).toBeDefined();
    });

    const onLangChange = annRow!.onLangChange as (l: string) => void;
    onLangChange("de");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel" && p.lang === "de"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  it("invokes removeAnnotationValue for custom annotations in edit mode", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [
              { value: "Label One", lang: "en" },
              { value: "Label Two", lang: "fr" },
            ],
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const annRows = capturedAnnotationRowProps.filter(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel"
    );
    const firstRow = annRows[0];
    expect(firstRow).toBeDefined();
    expect(firstRow!.onRemove).toBeDefined();
    const onRemoveAnn = firstRow!.onRemove as () => void;
    onRemoveAnn();
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── initEditState with seeAlso and isDefinedBy ──

  it("initializes edit state with seeAlso and isDefinedBy relationships", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
        isDefinedByIris: ["http://example.org/ontology#ontology"],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    expect(capturedRelationshipSectionProps!.isEditing).toBe(true);
  });

  // ── Remove label button interaction ──

  it("clicking remove label button triggers triggerSave", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        labels: [
          { value: "label1", lang: "en" },
          { value: "label2", lang: "fr" },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    const { container } = render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const removeButtons = container.querySelectorAll('button[title="Remove"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(removeButtons[0]);
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── Annotations read-only with resolved labels ──

  it("renders annotation property label in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Pref Label Value", lang: "en" }],
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Pref Label Value")).not.toBeNull();
  });

  // ── PropertyAssertionSection onSaveNeeded callback ──

  it("passes onSaveNeeded callback to PropertyAssertionSection", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const objectSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "object"
    );
    expect(objectSection).not.toBeNull();
    const onSaveNeeded = objectSection!.onSaveNeeded as () => void;
    onSaveNeeded();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Manual save stays in edit mode when flushToGit fails ──

  it("stays in edit mode when saveAndExitEditMode flush fails", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    mockFlushToGit.mockResolvedValue(false);
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onManualSave = capturedAutoSaveBarProps!.onManualSave as () => Promise<void>;
    await onManualSave();
    expect(mockTriggerSave).toHaveBeenCalled();
    expect(mockFlushToGit).toHaveBeenCalled();
    // Should still be in edit mode
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
  });

  // ── InlineAnnotationAdder onAdd adds to existing annotation ──

  it("InlineAnnotationAdder adds value to existing annotation property", async () => {
    const PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            values: [{ value: "Existing", lang: "en" }],
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedInlineAnnotationAdderProps).not.toBeNull();
    });

    const onAdd = capturedInlineAnnotationAdderProps!.onAdd as (propertyIri: string, value: string, lang: string) => void;
    onAdd(PREF_LABEL_IRI, "New Value", "fr");

    await waitFor(() => {
      const updatedRows = capturedAnnotationRowProps.filter(
        (p) => p.propertyIri === PREF_LABEL_IRI && p.value === "New Value"
      );
      expect(updatedRows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── InlineAnnotationAdder onAdd creates new annotation property ──

  it("InlineAnnotationAdder creates new annotation property when not existing", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ annotations: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
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
      const exampleRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#example"
      );
      expect(exampleRow).toBeDefined();
    });
  });

  // ── InlineAnnotationAdder onSaveNeeded callback ──

  it("InlineAnnotationAdder onSaveNeeded calls triggerSave", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    await waitFor(() => {
      expect(capturedInlineAnnotationAdderProps).not.toBeNull();
    });

    const onSaveNeeded = capturedInlineAnnotationAdderProps!.onSaveNeeded as () => void;
    onSaveNeeded();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── RelationshipSection onSaveNeeded callback ──

  it("RelationshipSection onSaveNeeded calls triggerSave", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
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

  // ── Labels section visible in read-only with labels ──

  it("renders labels section title in read-only when labels exist", () => {
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Label(s)")).not.toBeNull();
  });

  // ── Cancel in editor context prevents re-entry ──

  it("does not re-enter edit mode after cancel in editor context", async () => {
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();

    // Trigger cancel
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onCancel = capturedAutoSaveBarProps!.onCancel as () => void;
    onCancel();

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalled();
      expect(screen.getByText("Edit Item")).not.toBeNull();
    });
  });

  // ── Edit mode with isDefinedBy relationships ──

  it("initializes edit mode with isDefinedBy as separate relationship group", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        seeAlsoIris: [],
        isDefinedByIris: ["http://example.org/ontology#myOntology"],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();
    const groups = capturedRelationshipSectionProps!.groups as Array<{ property_label: string }>;
    const definedByGroup = groups.find((g) => g.property_label === "Defined By");
    expect(definedByGroup).toBeDefined();
  });

  // ── Object property assertion without targetIri ──

  it("renders object property assertion without target when targetIri is null", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasParent",
            targetIri: null,
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Object Properties")).not.toBeNull();
    // Should not crash when targetIri is null
    expect(screen.getByText("hasParent")).not.toBeNull();
  });

  // ── Edit mode with no labels initializes empty placeholder ──

  it("initializes edit mode with empty label placeholder when no labels", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({ labels: [] })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInputs = screen.getAllByPlaceholderText("Label text");
    expect(labelInputs.length).toBeGreaterThanOrEqual(1);
    expect((labelInputs[0] as HTMLInputElement).value).toBe("");
  });

  // ── Data property assertion with lang tag in read-only ──

  it("renders data property assertion with lang flag in read-only mode", () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ontology#hasName",
            value: "Jean",
            lang: "fr",
          },
        ],
      })
    );
    render(<IndividualDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Data Properties")).not.toBeNull();
    expect(screen.getByText("Jean")).not.toBeNull();
  });

  // ── PropertyAssertionSection data onSaveNeeded callback ──

  it("passes onSaveNeeded callback to data PropertyAssertionSection", async () => {
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const dataSection = capturedPropertyAssertionProps.find(
      (p) => p.assertionType === "data"
    );
    expect(dataSection).not.toBeNull();
    const onSaveNeeded = dataSection!.onSaveNeeded as () => void;
    onSaveNeeded();
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Annotation language change callback ──

  it("updates custom annotation language via AnnotationRow callback", async () => {
    mockExtractIndividualDetail.mockReturnValue(
      makeIndividualDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "J. Doe", lang: "en" }],
          },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateIndividual = vi.fn();
    render(
      <IndividualDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateIndividual={onUpdateIndividual}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel"
    );
    expect(annRow).not.toBeNull();
    const onLangChange = annRow!.onLangChange as (l: string) => void;
    onLangChange("de");

    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel" && p.lang === "de"
      );
      expect(updatedRow).toBeDefined();
    });
  });
});

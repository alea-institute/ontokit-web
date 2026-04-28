import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Configurable mock state (tests can override before render) ──

const mockExtractPropertyDetail = vi.fn();
vi.mock("@/lib/ontology/entityDetailExtractors", () => ({
  extractPropertyDetail: (...args: unknown[]) => mockExtractPropertyDetail(...args),
  PROPERTY_CHARACTERISTIC_TYPES: [
    { iri: "http://www.w3.org/2002/07/owl#FunctionalProperty", label: "Functional" },
    { iri: "http://www.w3.org/2002/07/owl#InverseFunctionalProperty", label: "Inverse Functional" },
    { iri: "http://www.w3.org/2002/07/owl#TransitiveProperty", label: "Transitive" },
    { iri: "http://www.w3.org/2002/07/owl#SymmetricProperty", label: "Symmetric" },
    { iri: "http://www.w3.org/2002/07/owl#AsymmetricProperty", label: "Asymmetric" },
    { iri: "http://www.w3.org/2002/07/owl#ReflexiveProperty", label: "Reflexive" },
    { iri: "http://www.w3.org/2002/07/owl#IrreflexiveProperty", label: "Irreflexive" },
  ],
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
    selector({ editorMode: "standard", preferEditMode: true, ...editorModeOverrides }),
}));

vi.mock("@/lib/hooks/useIriLabels", () => ({
  useIriLabels: () => ({}),
}));

// Stub child components - capture props for callback testing
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

let capturedAutoSaveBarProps: Record<string, unknown> | null = null;
vi.mock("@/components/editor/AutoSaveAffordanceBar", () => ({
  AutoSaveAffordanceBar: (props: Record<string, unknown>) => {
    capturedAutoSaveBarProps = props;
    return <div data-testid="auto-save-bar">AutoSaveBar</div>;
  },
}));

import { PropertyDetailPanel } from "@/components/editor/PropertyDetailPanel";

// ── Helpers ──

function makePropertyDetail(overrides: Record<string, unknown> = {}) {
  return {
    propertyType: "object" as const,
    labels: [{ value: "hasParent", lang: "en" }],
    comments: [{ value: "Relates a person to their parent", lang: "en" }],
    definitions: [{ value: "A relationship linking child to parent", lang: "en" }],
    annotations: [],
    domainIris: ["http://example.org/ontology#Person"],
    rangeIris: ["http://example.org/ontology#Person"],
    parentIris: ["http://example.org/ontology#hasRelative"],
    inverseOf: "http://example.org/ontology#hasChild",
    characteristics: ["http://www.w3.org/2002/07/owl#AsymmetricProperty"],
    deprecated: false,
    equivalentIris: [],
    disjointIris: [],
    seeAlsoIris: [],
    isDefinedByIris: [],
    ...overrides,
  };
}

const SAMPLE_SOURCE = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix : <http://example.org/ontology#> .
:hasParent a owl:ObjectProperty ;
  rdfs:label "hasParent"@en ;
  rdfs:comment "Relates a person to their parent"@en ;
  rdfs:domain :Person ;
  rdfs:range :Person ;
  rdfs:subPropertyOf :hasRelative ;
  owl:inverseOf :hasChild .
`;

const DEFAULT_PROPS = {
  projectId: "proj-1",
  propertyIri: "http://example.org/ontology#hasParent",
  sourceContent: SAMPLE_SOURCE,
  canEdit: false,
  accessToken: "test-token",
  branch: "main",
};

// ── Tests ──

describe("PropertyDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlushToGit.mockResolvedValue(true);
    autoSaveOverrides = {};
    editorModeOverrides = {};
    capturedAnnotationRowProps = [];
    capturedRelationshipSectionProps = null;
    capturedAutoSaveBarProps = null;
    capturedInlineAnnotationAdderProps = null;
    mockExtractPropertyDetail.mockReturnValue(makePropertyDetail());
  });

  // ── Empty / placeholder state ──

  it("renders 'Select a property' placeholder when propertyIri is null", () => {
    render(
      <PropertyDetailPanel
        projectId="proj-1"
        propertyIri={null}
        sourceContent=""
        canEdit={false}
      />
    );
    expect(
      screen.getByText("Select a property to view its details")
    ).toBeDefined();
  });

  // ── Loading state ──

  it("shows a loading spinner when sourceContent is empty", () => {
    const { container } = render(
      <PropertyDetailPanel
        projectId="proj-1"
        propertyIri="http://example.org/ontology#hasParent"
        sourceContent=""
        canEdit={false}
      />
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  // ── Not found state ──

  it("shows not-found message when extractPropertyDetail returns null", () => {
    mockExtractPropertyDetail.mockReturnValue(null);
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("Could not find this property in the ontology source.")
    ).toBeDefined();
  });

  it("shows property IRI in not-found state header", () => {
    mockExtractPropertyDetail.mockReturnValue(null);
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("http://example.org/ontology#hasParent")
    ).toBeDefined();
  });

  it("shows local name in not-found state header", () => {
    mockExtractPropertyDetail.mockReturnValue(null);
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("hasParent")).toBeDefined();
  });

  // ── Successful render ──

  it("renders property label and IRI", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getAllByText("hasParent").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("http://example.org/ontology#hasParent")
    ).toBeDefined();
  });

  it("renders property type badge for object property", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Object Property")).toBeDefined();
  });

  it("renders property type badge for data property", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ propertyType: "data" })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Data Property")).toBeDefined();
  });

  it("renders property type badge for annotation property", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ propertyType: "annotation" })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Annotation Property")).toBeDefined();
  });

  it("renders deprecated badge when property is deprecated", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ deprecated: true })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Deprecated")).toBeDefined();
  });

  it("renders comments section", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("Relates a person to their parent")
    ).toBeDefined();
  });

  it("renders definitions section", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(
      screen.getByText("A relationship linking child to parent")
    ).toBeDefined();
  });

  it("renders domain section", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Domain")).toBeDefined();
  });

  it("renders range section", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Range")).toBeDefined();
  });

  it("renders parent properties section", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Parent Properties")).toBeDefined();
  });

  it("renders inverse of section for object properties", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Inverse Of")).toBeDefined();
  });

  it("renders characteristics section for object properties", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Characteristics")).toBeDefined();
    expect(screen.getByText("Asymmetric")).toBeDefined();
  });

  it("renders equivalent properties when present", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        equivalentIris: ["http://example.org/ontology#hasProgenitor"],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Equivalent Properties")).toBeDefined();
  });

  it("renders disjoint properties when present", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        disjointIris: ["http://example.org/ontology#hasEnemy"],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Disjoint Properties")).toBeDefined();
  });

  it("renders annotations when present", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Parent Property", lang: "en" }],
          },
        ],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Parent Property")).toBeDefined();
  });

  it("does not render empty optional sections", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        domainIris: [],
        rangeIris: [],
        parentIris: [],
        inverseOf: null,
        characteristics: [],
        equivalentIris: [],
        disjointIris: [],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.queryByText("Domain")).toBeNull();
    expect(screen.queryByText("Range")).toBeNull();
    expect(screen.queryByText("Parent Properties")).toBeNull();
    expect(screen.queryByText("Equivalent Properties")).toBeNull();
    expect(screen.queryByText("Disjoint Properties")).toBeNull();
  });

  // ── Copy IRI ──

  it("renders Copy IRI button when onCopyIri is provided", () => {
    const onCopyIri = vi.fn();
    render(<PropertyDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);
    expect(screen.getByTitle("Copy IRI")).toBeDefined();
  });

  it("calls onCopyIri when Copy IRI button is clicked", async () => {
    const user = userEvent.setup();
    const onCopyIri = vi.fn();
    render(<PropertyDetailPanel {...DEFAULT_PROPS} onCopyIri={onCopyIri} />);
    await user.click(screen.getByTitle("Copy IRI"));
    expect(onCopyIri).toHaveBeenCalledWith(
      "http://example.org/ontology#hasParent"
    );
  });

  // ── Read-only mode (canEdit=false) ──

  it("does not show edit button when canEdit is false", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Edit mode (canEdit=true) ──

  it("auto-enters edit mode when canEdit is true and onUpdateProperty provided", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  it("enters edit mode when Edit Item is clicked", async () => {
    editorModeOverrides = { preferEditMode: false };
    const user = userEvent.setup();
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );

    // With preferEditMode off the panel mounts read-only; user must click Edit Item.
    await waitFor(() => {
      expect(screen.getByText("Edit Item")).not.toBeNull();
    });
    expect(screen.queryByTestId("auto-save-bar")).toBeNull();

    await user.click(screen.getByText("Edit Item"));

    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  // ── API call verification ──

  it("calls extractPropertyDetail with sourceContent and propertyIri", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(mockExtractPropertyDetail).toHaveBeenCalledWith(
      SAMPLE_SOURCE,
      "http://example.org/ontology#hasParent"
    );
  });

  it("re-parses when refreshKey changes", () => {
    const { rerender } = render(
      <PropertyDetailPanel {...DEFAULT_PROPS} refreshKey={1} />
    );
    expect(mockExtractPropertyDetail).toHaveBeenCalledTimes(1);

    rerender(<PropertyDetailPanel {...DEFAULT_PROPS} refreshKey={2} />);
    expect(mockExtractPropertyDetail).toHaveBeenCalledTimes(2);
  });

  // ── Falls back to local name when no labels ──

  it("renders local name when property has no labels", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ labels: [] })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    // The header should still show "hasParent" from getLocalName
    expect(screen.getAllByText("hasParent").length).toBeGreaterThanOrEqual(1);
  });

  // ── Relationships section ──

  it("renders relationships section when seeAlsoIris present", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: ["http://example.org/ontology#relatedProp"],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Relationships")).toBeDefined();
  });

  it("does not render relationships section when no seeAlso or isDefinedBy", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: [],
        isDefinedByIris: [],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Relationships")).toBeNull();
  });

  // ── Edit mode: label editing ──

  it("renders editable label inputs in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInputs = screen.getAllByPlaceholderText("Label text");
    expect(labelInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders editable comment section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // The comment section title should be visible
    expect(screen.getByText("Comment(s)")).not.toBeNull();
  });

  it("renders editable definition section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Definition")).not.toBeNull();
  });

  it("renders domain section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Domain")).not.toBeNull();
  });

  it("renders range section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Range")).not.toBeNull();
  });

  it("renders characteristics checkboxes in edit mode for object property", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Functional")).not.toBeNull();
    expect(screen.getByText("Transitive")).not.toBeNull();
    expect(screen.getByText("Symmetric")).not.toBeNull();
  });

  it("renders inverse-of section in edit mode for object property", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Inverse Of")).not.toBeNull();
  });

  it("renders annotations section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Annotations")).not.toBeNull();
  });

  it("renders relationships section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInput = screen.getAllByPlaceholderText("Label text")[0];
    await user.clear(labelInput);
    await user.type(labelInput, "newLabel");
    expect((labelInput as HTMLInputElement).value).toBe("newLabel");
  });

  // ── Characteristic toggle in edit mode ──

  it("toggles characteristic checkbox in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    const { container } = render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Find the "Functional" checkbox (unchecked by default since not in characteristics)
    const functionalCheckbox = container.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(functionalCheckbox).not.toBeNull();
    // Asymmetric should be checked (in the default characteristics)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const asymmetricCheckbox = Array.from(checkboxes).find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Asymmetric");
    }) as HTMLInputElement | undefined;
    expect(asymmetricCheckbox).not.toBeNull();
    expect(asymmetricCheckbox!.checked).toBe(true);
  });

  // ── Cancel edit mode ──

  it("exits edit mode and calls discardDraft when cancel flow is triggered", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Verify we are in edit mode
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();

    // Trigger cancel via the captured AutoSaveAffordanceBar callback
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onCancel = capturedAutoSaveBarProps!.onCancel as () => void;
    expect(onCancel).toBeDefined();
    onCancel();

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalled();
      // Verify edit mode exited — "Edit Item" button should be visible again
      expect(screen.getByText("Edit Item")).not.toBeNull();
    });
  });

  // ── Auto-enter edit mode gated by preferEditMode ──

  it("auto-enters edit mode when preferEditMode is on (editor context)", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    // Should auto-enter edit mode and show auto-save bar
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
  });

  it("does not auto-enter edit mode when preferEditMode is off", async () => {
    editorModeOverrides = { preferEditMode: false };
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Edit Item")).not.toBeNull();
    });
    expect(screen.queryByTestId("auto-save-bar")).toBeNull();
  });

  // ── Draft restoration ──

  it("auto-enters edit mode when restoredDraft is available", () => {
    autoSaveOverrides = {
      restoredDraft: {
        entityType: "property",
        propertyType: "object",
        labels: [{ value: "Restored Label", lang: "en" }],
        comments: [{ value: "Restored Comment", lang: "en" }],
        definitions: [],
        domainIris: [],
        rangeIris: [],
        parentIris: [],
        inverseOf: null,
        characteristics: [],
        annotations: [],
        relationships: [],
        deprecated: false,
        equivalentIris: [],
        disjointIris: [],
        updatedAt: Date.now(),
      },
    };
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    expect(mockClearRestoredDraft).toHaveBeenCalled();
  });

  // ── flushToGit on IRI change ──

  it("calls flushToGit when propertyIri changes", async () => {
    const { rerender } = render(
      <PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />
    );
    rerender(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        propertyIri="http://example.org/ontology#hasChild"
        canEdit={false}
      />
    );
    await waitFor(() => {
      expect(mockFlushToGit).toHaveBeenCalled();
    });
  });

  // ── Does not show characteristics for data properties ──

  it("does not render characteristics for data properties", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ propertyType: "data", characteristics: [] })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.queryByText("Characteristics")).toBeNull();
  });

  // ── Does not render inverse-of for data properties ──

  it("does not render inverse-of for data properties", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ propertyType: "data", inverseOf: null })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.queryByText("Inverse Of")).toBeNull();
  });

  // ── Does not render inverse-of for annotation properties ──

  it("does not render inverse-of for annotation properties", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ propertyType: "annotation", inverseOf: null })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.queryByText("Inverse Of")).toBeNull();
  });

  // ── Does not auto-enter edit mode when canEdit is false ──

  it("does not auto-enter edit mode when canEdit is false even with onUpdateProperty", () => {
    render(
      <PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} onUpdateProperty={vi.fn()} />
    );
    expect(screen.queryByTestId("auto-save-bar")).toBeNull();
  });

  // ── Does not auto-enter edit mode without onUpdateProperty ──

  it("does not show edit button when canEdit is true but onUpdateProperty is not provided", () => {
    render(
      <PropertyDetailPanel {...DEFAULT_PROPS} canEdit={true} />
    );
    expect(screen.queryByText("Edit Item")).toBeNull();
  });

  // ── Language tag input in edit mode ──

  it("renders language tag pickers in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const langPickers = screen.getAllByLabelText("Language tag");
    expect(langPickers.length).toBeGreaterThanOrEqual(1);
  });

  // ── triggerSave on blur of label input ──

  it("calls triggerSave on blur of label input", async () => {
    const user = userEvent.setup();
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        isDefinedByIris: ["http://example.org/ontology"],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Relationships")).not.toBeNull();
  });

  // ── Parent properties section in edit mode ──

  it("renders parent properties section in edit mode", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Parent Properties")).not.toBeNull();
  });

  // ── Does not enter edit mode on draft restoration when entityType mismatches ──

  it("does not restore draft when entityType does not match property", async () => {
    autoSaveOverrides = {
      restoredDraft: {
        entityType: "class",
        labels: [{ value: "Wrong type", lang: "en" }],
        updatedAt: Date.now(),
      },
    };
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    // Edit mode auto-enters (editor context), but the wrong-type draft should not be applied
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // The "Wrong type" label from the class draft should not appear
    expect(screen.queryByDisplayValue("Wrong type")).toBeNull();
  });

  // ── Remove label button in edit mode ──

  it("shows remove button when multiple labels exist in edit mode", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        labels: [
          { value: "hasParent", lang: "en" },
          { value: "aParent", lang: "fr" },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    const { container } = render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const removeButtons = container.querySelectorAll('button[title="Remove"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Language tag editing in edit mode ──

  it("allows editing language tag via picker", async () => {
    const user = userEvent.setup();
    const onUpdateProperty = vi.fn();
    mockTriggerSave.mockClear();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const langPickers = screen.getAllByLabelText("Language tag");
    expect(langPickers.length).toBeGreaterThanOrEqual(1);
    await user.selectOptions(langPickers[0], "fr");
    expect((langPickers[0] as HTMLSelectElement).value).toBe("fr");
    expect(mockTriggerSave).toHaveBeenCalled();
  });

  // ── Edit mode with no initial comments ──

  it("renders empty comment placeholder in edit mode when no comments", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ comments: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Comment section should still render in edit mode
    expect(screen.getByText("Comment(s)")).not.toBeNull();
  });

  // ── Edit mode with no initial definitions ──

  it("renders empty definition placeholder in edit mode when no definitions", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ definitions: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Definition")).not.toBeNull();
  });

  // ── Edit mode with empty domain/range ──

  it("renders domain search in edit mode even when empty", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ domainIris: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Domain")).not.toBeNull();
  });

  it("renders range search in edit mode even when empty", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ rangeIris: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Range")).not.toBeNull();
  });

  // ── Edit mode with empty parent properties ──

  it("renders parent properties search in edit mode even when empty", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ parentIris: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Parent Properties")).not.toBeNull();
  });

  // ── Edit mode with inverse-of empty for object property ──

  it("renders inverse-of search in edit mode for object property with no inverse", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ inverseOf: null })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(screen.getByText("Inverse Of")).not.toBeNull();
  });

  // ── Characteristics in edit mode for object property with no characteristics ──

  it("renders all characteristic checkboxes in edit mode when none selected", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ characteristics: [] })
    );
    const onUpdateProperty = vi.fn();
    const { container } = render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // Should have 7 characteristic checkboxes
    expect(checkboxes.length).toBe(7);
    // All unchecked
    const allUnchecked = Array.from(checkboxes).every(
      (cb) => !(cb as HTMLInputElement).checked
    );
    expect(allUnchecked).toBe(true);
  });

  // ── Navigate to entity callback ──

  it("calls onNavigateToEntity when domain IRI link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        onNavigateToEntity={onNavigate}
      />
    );
    // Domain section has IRI links in read-only mode
    const personLink = screen.getAllByText("Person")[0];
    await user.click(personLink);
    expect(onNavigate).toHaveBeenCalledWith(
      "http://example.org/ontology#Person"
    );
  });

  // ── Multiple comments in read-only ──

  it("renders multiple comments in read-only mode", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        comments: [
          { value: "First comment", lang: "en" },
          { value: "Second comment", lang: "fr" },
        ],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("First comment")).not.toBeNull();
    expect(screen.getByText("Second comment")).not.toBeNull();
  });

  // ── Multiple definitions in read-only ──

  it("renders multiple definitions in read-only mode", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        definitions: [
          { value: "Def one", lang: "en" },
          { value: "Def two", lang: "fr" },
        ],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Def one")).not.toBeNull();
    expect(screen.getByText("Def two")).not.toBeNull();
  });

  // ── Characteristic toggle interaction ──

  it("clicking a characteristic checkbox calls triggerSave via requestAnimationFrame", async () => {
    const user = userEvent.setup();
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Click the "Functional" checkbox
    const functionalLabel = screen.getByText("Functional");
    await user.click(functionalLabel);
    // triggerSave is called via requestAnimationFrame in toggleCharacteristic
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  // ── IRI navigation in read-only domain/range ──

  it("renders parent property links in read-only mode", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    // hasRelative is a parent property
    expect(screen.getByText("hasRelative")).not.toBeNull();
  });

  it("renders inverse-of link in read-only mode", () => {
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("hasChild")).not.toBeNull();
  });

  // ── Empty labels does not render labels section in read-only ──

  it("does not render labels section in read-only when no labels", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ labels: [] })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Label(s)")).toBeNull();
  });

  // ── Empty comments does not render comments section in read-only ──

  it("does not render comments section in read-only when no comments", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ comments: [] })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Comment(s)")).toBeNull();
  });

  // ── Empty definitions does not render definitions section in read-only ──

  it("does not render definitions section in read-only when no definitions", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ definitions: [] })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} canEdit={false} />);
    expect(screen.queryByText("Definition")).toBeNull();
  });

  // ── Cancel edit mode via AutoSaveAffordanceBar ──

  it("invokes cancelEditMode via AutoSaveAffordanceBar onCancel", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedAutoSaveBarProps).not.toBeNull();
    // Call the onCancel callback from AutoSaveAffordanceBar
    const onCancel = capturedAutoSaveBarProps!.onCancel as () => void;
    onCancel();
    expect(mockDiscardDraft).toHaveBeenCalled();
  });

  // ── Manual save via AutoSaveAffordanceBar ──

  it("invokes saveAndExitEditMode via AutoSaveAffordanceBar onManualSave", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Find the AnnotationRow for comments (COMMENT_IRI)
    const commentRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment"
    );
    expect(commentRow).not.toBeNull();
    // Call onValueChange — updates state (re-renders AnnotationRow with new value)
    const onValueChange = commentRow!.onValueChange as (v: string) => void;
    onValueChange("Updated comment");

    // Verify the updated value propagates to the re-rendered AnnotationRow
    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment" && p.value === "Updated comment"
      );
      expect(updatedRow).toBeDefined();
    });

    // Call onLangChange — updates language tag
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        comments: [
          { value: "First comment", lang: "en" },
          { value: "Second comment", lang: "fr" },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const commentRows = capturedAnnotationRowProps.filter(
      (p) => p.propertyIri === "http://www.w3.org/2000/01/rdf-schema#comment"
    );
    // The first comment row should have onRemove defined
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        definitions: [
          { value: "First def", lang: "en" },
          { value: "Second def", lang: "fr" },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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

  // ── RelationshipSection callbacks ──

  it("passes relationship callbacks to RelationshipSection in edit mode", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    expect(capturedRelationshipSectionProps).not.toBeNull();

    // Test addTarget
    const onAddTarget = capturedRelationshipSectionProps!.onAddTarget as (groupIdx: number, target: { iri: string; label: string }) => void;
    onAddTarget(0, { iri: "http://example.org/ontology#newRelated", label: "newRelated" });
    await waitFor(() => {
      expect(mockTriggerSave).toHaveBeenCalled();
    });
  });

  it("invokes removeRelationshipTarget via RelationshipSection", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Parent Property", lang: "en" }],
          },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    // Find annotation row for the custom annotation
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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

  it("initializes edit state with seeAlso relationships", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: ["http://example.org/ontology#related"],
        isDefinedByIris: ["http://example.org/ontology#ontology"],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        labels: [
          { value: "label1", lang: "en" },
          { value: "label2", lang: "fr" },
        ],
      })
    );
    const user = userEvent.setup();
    const onUpdateProperty = vi.fn();
    const { container } = render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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

  it("renders annotation property label from resolvedLabels", () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Pref Label Value", lang: "en" }],
          },
        ],
      })
    );
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Pref Label Value")).not.toBeNull();
  });

  // ── Manual save stays in edit mode when flushToGit fails ──

  it("stays in edit mode when saveAndExitEditMode flush fails", async () => {
    const onUpdateProperty = vi.fn();
    mockFlushToGit.mockResolvedValue(false);
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        annotations: [
          {
            property_iri: PREF_LABEL_IRI,
            values: [{ value: "Existing", lang: "en" }],
          },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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

    // Verify new annotation row appears
    await waitFor(() => {
      const updatedRows = capturedAnnotationRowProps.filter(
        (p) => p.propertyIri === PREF_LABEL_IRI && p.value === "New Value"
      );
      expect(updatedRows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── InlineAnnotationAdder onAdd creates new annotation property ──

  it("InlineAnnotationAdder creates new annotation property when not existing", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ annotations: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
    render(<PropertyDetailPanel {...DEFAULT_PROPS} />);
    expect(screen.getByText("Label(s)")).not.toBeNull();
  });

  // ── Cancel in editor context prevents re-entry ──

  it("does not re-enter edit mode after cancel in editor context", async () => {
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });

    // Trigger cancel
    expect(capturedAutoSaveBarProps).not.toBeNull();
    const onCancel = capturedAutoSaveBarProps!.onCancel as () => void;
    onCancel();

    await waitFor(() => {
      expect(mockDiscardDraft).toHaveBeenCalled();
      expect(screen.getByText("Edit Item")).not.toBeNull();
    });
  });

  // ── Edit mode with existing annotations shows custom annotation editing ──

  it("renders annotation language change callback in edit mode", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Parent Property", lang: "en" }],
          },
        ],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const annRow = capturedAnnotationRowProps.find(
      (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel"
    );
    expect(annRow).not.toBeNull();
    // Call onLangChange
    const onLangChange = annRow!.onLangChange as (l: string) => void;
    onLangChange("de");
    await waitFor(() => {
      const updatedRow = capturedAnnotationRowProps.find(
        (p) => p.propertyIri === "http://www.w3.org/2004/02/skos/core#prefLabel" && p.lang === "de"
      );
      expect(updatedRow).toBeDefined();
    });
  });

  // ── Edit mode with no labels initializes empty placeholder ──

  it("initializes edit mode with empty label placeholder when no labels", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({ labels: [] })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("auto-save-bar")).not.toBeNull();
    });
    const labelInputs = screen.getAllByPlaceholderText("Label text");
    expect(labelInputs.length).toBeGreaterThanOrEqual(1);
    expect((labelInputs[0] as HTMLInputElement).value).toBe("");
  });

  // ── Edit mode with isDefinedBy relationships ──

  it("initializes edit mode with isDefinedBy as separate relationship group", async () => {
    mockExtractPropertyDetail.mockReturnValue(
      makePropertyDetail({
        seeAlsoIris: [],
        isDefinedByIris: ["http://example.org/ontology#myOntology"],
      })
    );
    const onUpdateProperty = vi.fn();
    render(
      <PropertyDetailPanel
        {...DEFAULT_PROPS}
        canEdit={true}
        onUpdateProperty={onUpdateProperty}
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
});

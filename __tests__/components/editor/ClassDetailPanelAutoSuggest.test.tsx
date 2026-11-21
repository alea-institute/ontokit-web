import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ── Mocks (must precede component import) ──

vi.mock("@/lib/api/client", () => ({
  projectOntologyApi: {
    getClassDetail: vi.fn(),
    searchEntities: vi.fn(),
  },
}));

vi.mock("@/lib/api/lint", () => ({
  lintApi: { getIssues: vi.fn() },
}));

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/hooks/useTranslationConfig", () => ({
  useTranslationConfig: () => ({ config: { language_tags: [] } }),
}));
vi.mock("@/lib/hooks/useTranslationState", () => ({
  useTranslationState: () => ({
    state: null,
    translateField: vi.fn(),
    isTranslating: false,
    translateError: null,
    isTranslationPending: false,
    pendingNotice: null,
    resetTranslation: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAutoSave", () => ({
  useAutoSave: () => ({
    saveStatus: "idle",
    saveError: null,
    validationError: null,
    isDirty: false,
    triggerSave: vi.fn(),
    flushToGit: vi.fn().mockResolvedValue(true),
    discardDraft: vi.fn(),
    editStateRef: { current: null },
    restoredDraft: null,
    clearRestoredDraft: vi.fn(),
  }),
}));

// Capture one request() fn per suggestion type so we can assert exactly which
// section auto-fired.
const requestFns: Record<string, Mock> = {};
vi.mock("@/lib/hooks/useSuggestions", () => ({
  useSuggestions: (opts: { suggestionType: string }) => {
    const key = opts.suggestionType;
    if (!requestFns[key]) requestFns[key] = vi.fn();
    return {
      items: [],
      acceptingIndices: new Set(),
      isLoading: false,
      error: null,
      request: requestFns[key],
      accept: vi.fn(),
      reject: vi.fn(),
      edit: vi.fn(),
    };
  },
}));

// Stub network-y / heavy children so the panel renders in isolation.
vi.mock("@/components/editor/LanguageFlag", () => ({ LanguageFlag: () => null }));
vi.mock("@/components/editor/LanguagePicker", () => ({ LanguagePicker: () => null }));
vi.mock("@/components/editor/ParentClassPicker", () => ({ ParentClassPicker: () => null }));
vi.mock("@/components/editor/standard/AnnotationRow", () => ({ AnnotationRow: () => null }));
vi.mock("@/components/editor/standard/InlineAnnotationAdder", () => ({ InlineAnnotationAdder: () => null }));
vi.mock("@/components/editor/standard/RelationshipSection", () => ({ RelationshipSection: () => null }));
vi.mock("@/components/editor/AutoSaveAffordanceBar", () => ({ AutoSaveAffordanceBar: () => null }));
vi.mock("@/components/editor/CrossReferencesPanel", () => ({ CrossReferencesPanel: () => null }));
vi.mock("@/components/editor/SimilarConceptsPanel", () => ({ SimilarConceptsPanel: () => null }));
vi.mock("@/components/editor/EntityHistoryTab", () => ({ EntityHistoryTab: () => null }));

import { ClassDetailPanel } from "@/components/editor/ClassDetailPanel";
import { projectOntologyApi } from "@/lib/api/client";
import { lintApi } from "@/lib/api/lint";

const mockGetClassDetail = projectOntologyApi.getClassDetail as Mock;
const mockGetIssues = lintApi.getIssues as Mock;

function makeClassDetail() {
  return {
    iri: "http://example.org/ontology#Person",
    labels: [{ value: "Person", lang: "en" }],
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
  };
}

const BASE_PROPS = {
  projectId: "proj-1",
  classIri: "http://example.org/ontology#Person",
  accessToken: "test-token",
  branch: "main",
};

describe("ClassDetailPanel auto-suggest on navigate (M-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(requestFns)) delete requestFns[key];
    mockGetClassDetail.mockResolvedValue(makeClassDetail());
    mockGetIssues.mockResolvedValue({ items: [] });
  });

  it("requests siblings using the selected batch size", async () => {
    mockGetClassDetail.mockResolvedValue({
      ...makeClassDetail(), parent_iris: ["https://example.org/Agent"],
    });
    render(<ClassDetailPanel {...BASE_PROPS} canUseLLM />);
    const button = await screen.findByRole("button", { name: "Suggest siblings" });
    fireEvent.change(screen.getByLabelText("Batch size"), { target: { value: "10" } });
    fireEvent.click(button);
    expect(requestFns.siblings).toHaveBeenCalledExactlyOnceWith(10, expect.any(Function));
  });

  it("explains why sibling suggestions are disabled for a root", async () => {
    render(<ClassDetailPanel {...BASE_PROPS} canUseLLM />);
    const button = await screen.findByRole("button", { name: "Suggest siblings" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toMatch(/no parent/i);
    fireEvent.click(button);
    expect(requestFns.siblings).not.toHaveBeenCalled();
  });

  it("drops a tree request when the reader leaves before the class loads", async () => {
    const intent = { kind: "children" as const, iri: BASE_PROPS.classIri, projectId: "proj-1", branch: "main" };
    const consumed = vi.fn();
    let resolveDetail: (detail: ReturnType<typeof makeClassDetail>) => void = () => {};
    mockGetClassDetail.mockImplementationOnce(() => new Promise((resolve) => { resolveDetail = resolve; }));
    const props = { ...BASE_PROPS, canUseLLM: true, autoSuggestOnMount: intent, onAutoSuggestConsumed: consumed };
    const view = render(<ClassDetailPanel {...props} />);
    await waitFor(() => expect(mockGetClassDetail).toHaveBeenCalledTimes(1));

    view.rerender(<ClassDetailPanel {...props} classIri="http://example.org/ontology#Other" />);
    await waitFor(() => expect(consumed).toHaveBeenCalledExactlyOnceWith(intent));
    resolveDetail(makeClassDetail());

    // The layout would clear the request; a late return must not spend a call either way.
    view.rerender(<ClassDetailPanel {...props} />);
    await screen.findByRole("button", { name: "Suggest subclasses" });
    expect(requestFns.children).not.toHaveBeenCalled();
  });

  it("fires the annotation request exactly once on mount when flagged", async () => {
    render(
      <ClassDetailPanel
        {...BASE_PROPS}
        canUseLLM
        autoSuggestAnnotationsOnMount
      />,
    );

    await waitFor(() => {
      expect(requestFns.annotations).toBeDefined();
      expect(requestFns.annotations).toHaveBeenCalledTimes(1);
    });

    // Only the annotations section auto-fires — not children/siblings/etc.
    expect(requestFns.children ?? vi.fn()).not.toHaveBeenCalled();
    expect(requestFns.parents ?? vi.fn()).not.toHaveBeenCalled();
  });

  it("does NOT auto-fire when the navigate flag is unset", async () => {
    render(
      <ClassDetailPanel
        {...BASE_PROPS}
        canUseLLM
        autoSuggestAnnotationsOnMount={false}
      />,
    );

    // Give effects a chance to run.
    await waitFor(() => expect(mockGetClassDetail).toHaveBeenCalled());
    expect(requestFns.annotations ?? vi.fn()).not.toHaveBeenCalled();
  });

  it("does NOT auto-fire when the project lacks LLM access", async () => {
    render(
      <ClassDetailPanel
        {...BASE_PROPS}
        canUseLLM={false}
        autoSuggestAnnotationsOnMount
      />,
    );

    await waitFor(() => expect(mockGetClassDetail).toHaveBeenCalled());
    expect(requestFns.annotations ?? vi.fn()).not.toHaveBeenCalled();
  });
});

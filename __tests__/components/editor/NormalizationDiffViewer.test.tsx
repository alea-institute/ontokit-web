import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Capture beforeMount/onMount callbacks from mock
let capturedBeforeMount: ((monaco: MockMonaco) => void) | undefined;
let capturedOnMount: ((editor: MockEditor) => void) | undefined;

interface MockMonaco {
  editor: {
    defineTheme: ReturnType<typeof vi.fn>;
  };
}

interface MockEditor {
  dispose: ReturnType<typeof vi.fn>;
}

// Mock Monaco DiffEditor since it requires browser APIs
vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props: Record<string, unknown>) => {
    capturedBeforeMount = props.beforeMount as typeof capturedBeforeMount;
    capturedOnMount = props.onMount as typeof capturedOnMount;
    return (
      <div data-testid="diff-editor" data-original={props.original} data-modified={props.modified} />
    );
  },
}));

const mockRegisterTurtleLanguage = vi.fn();
vi.mock("@/lib/editor/languages/turtle", () => ({
  registerTurtleLanguage: (...args: unknown[]) => mockRegisterTurtleLanguage(...args),
}));

import { NormalizationDiffViewer } from "@/components/editor/NormalizationDiffViewer";

describe("NormalizationDiffViewer", () => {
  const defaultProps = {
    originalContent: "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    normalizedContent: "@prefix owl:  <http://www.w3.org/2002/07/owl#> .\n",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedBeforeMount = undefined;
    capturedOnMount = undefined;
  });

  it("renders the header", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(screen.getByText("Normalization Preview")).toBeDefined();
  });

  it("renders Original and Normalized labels", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(screen.getByText("Original")).toBeDefined();
    expect(screen.getByText("Normalized")).toBeDefined();
  });

  it("renders the diff editor", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(screen.getByTestId("diff-editor")).toBeDefined();
  });

  it("passes original and modified content to DiffEditor", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    const editor = screen.getByTestId("diff-editor");
    expect(editor.getAttribute("data-original")).toBe(defaultProps.originalContent);
    expect(editor.getAttribute("data-modified")).toBe(defaultProps.normalizedContent);
  });

  it("renders footer with instructions", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(
      screen.getByText(/Click .Run Normalization. in settings to apply these changes/)
    ).toBeDefined();
  });

  it("calls onClose when Close button is clicked", async () => {
    const onClose = vi.fn();
    render(<NormalizationDiffViewer {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls registerTurtleLanguage and defineTheme in beforeMount", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(capturedBeforeMount).toBeDefined();
    const mockMonaco: MockMonaco = {
      editor: { defineTheme: vi.fn() },
    };
    capturedBeforeMount!(mockMonaco);
    expect(mockRegisterTurtleLanguage).toHaveBeenCalledWith(mockMonaco);
    expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
      "diff-dark",
      expect.objectContaining({ base: "vs-dark", inherit: true }),
    );
  });

  it("stores editor reference in onMount callback", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(capturedOnMount).toBeDefined();
    const mockEditor: MockEditor = { dispose: vi.fn() };
    capturedOnMount!(mockEditor);
    // No error thrown = success; editor is stored internally
  });

  it("disposes editor when header X button is clicked", async () => {
    const onClose = vi.fn();
    render(<NormalizationDiffViewer {...defaultProps} onClose={onClose} />);

    // Simulate mounting the editor
    const mockEditor: MockEditor = { dispose: vi.fn() };
    capturedOnMount!(mockEditor);

    // Click the X button (the ghost button in header)
    const buttons = screen.getAllByRole("button");
    // The X button is the first button (in the header)
    await userEvent.click(buttons[0]);

    expect(mockEditor.dispose).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose even when no editor was mounted", async () => {
    const onClose = vi.fn();
    render(<NormalizationDiffViewer {...defaultProps} onClose={onClose} />);
    // Don't call capturedOnMount - editor was never mounted
    await userEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the description text", () => {
    render(<NormalizationDiffViewer {...defaultProps} />);
    expect(
      screen.getByText("Review the changes that will be made to your ontology file"),
    ).toBeDefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---- matchMedia polyfill ----
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---- Monaco mock ----
const mockRegister = vi.fn();
const mockSetMonarchTokensProvider = vi.fn();
const mockSetLanguageConfiguration = vi.fn();
const mockRegisterCompletionItemProvider = vi.fn();
const mockRegisterHoverProvider = vi.fn();
const mockRegisterLinkProvider = vi.fn();
const mockDefineTheme = vi.fn();

let capturedBeforeMount: ((monaco: unknown) => void) | null = null;
let capturedOnMount: ((editor: unknown, monaco: unknown) => void) | null = null;
let capturedProps: Record<string, unknown> = {};

vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");

  const EditorComponent = (props: Record<string, unknown>) => {
    // eslint-disable-next-line react-hooks/globals
    capturedProps = props;

    React.useEffect(() => {
      if (typeof props.beforeMount === "function" && capturedBeforeMount !== props.beforeMount) {
        capturedBeforeMount = props.beforeMount as (monaco: unknown) => void;
        (props.beforeMount as (m: unknown) => void)({
          languages: {
            register: mockRegister,
            setMonarchTokensProvider: mockSetMonarchTokensProvider,
            setLanguageConfiguration: mockSetLanguageConfiguration,
            registerCompletionItemProvider: mockRegisterCompletionItemProvider,
            registerHoverProvider: mockRegisterHoverProvider,
            registerLinkProvider: mockRegisterLinkProvider,
            CompletionItemKind: { Snippet: 1, Property: 2, Class: 3 },
            CompletionItemInsertTextRule: { InsertAsSnippet: 1 },
          },
          editor: {
            defineTheme: mockDefineTheme,
          },
        });
      }
    }, []);

    React.useEffect(() => {
      if (typeof props.onMount === "function" && capturedOnMount !== props.onMount) {
        capturedOnMount = props.onMount as (editor: unknown, monaco: unknown) => void;
        const mockModel = {
          getValue: vi.fn(() => ""),
          getLineContent: vi.fn(() => ""),
          getLineCount: vi.fn(() => 1),
          isDisposed: vi.fn(() => false),
          getWordUntilPosition: vi.fn(() => ({ startColumn: 1, endColumn: 1, word: "" })),
        };
        const mockEditor = {
          getModel: vi.fn(() => mockModel),
          onMouseDown: vi.fn(),
        };
        const mockMonaco = {
          MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
          editor: {
            setModelMarkers: vi.fn(),
            MouseTargetType: { GUTTER_GLYPH_MARGIN: 2 },
          },
        };
        (props.onMount as (e: unknown, m: unknown) => void)(mockEditor, mockMonaco);
      }
    }, []);

    return React.createElement("div", {
      "data-testid": "monaco-editor",
      "data-language": props.defaultLanguage,
      "data-readonly": String((props.options as Record<string, unknown>)?.readOnly ?? false),
    });
  };

  return {
    __esModule: true,
    default: EditorComponent,
    OnMount: {},
    BeforeMount: {},
    loader: { config: vi.fn() },
  };
});

vi.mock("@/lib/editor/languages/turtle", () => ({
  turtleLanguageConfiguration: {},
  turtleTokensProvider: {},
  commonPrefixes: [
    { prefix: "owl", namespace: "http://www.w3.org/2002/07/owl#" },
    { prefix: "rdfs", namespace: "http://www.w3.org/2000/01/rdf-schema#" },
  ],
  commonProperties: [
    { label: "rdfs:label", detail: "A human-readable label" },
  ],
  TURTLE_LANGUAGE_ID: "turtle",
}));

// Reset the module-level `languageRegistered` flag between tests
// by re-importing the module after resetting the mock state
let TurtleEditor: typeof import("@/components/editor/TurtleEditor").TurtleEditor;

beforeEach(async () => {
  vi.resetModules();
  capturedBeforeMount = null;
  capturedOnMount = null;
  capturedProps = {};
  mockRegister.mockClear();
  mockSetMonarchTokensProvider.mockClear();
  mockSetLanguageConfiguration.mockClear();
  mockRegisterCompletionItemProvider.mockClear();
  mockRegisterHoverProvider.mockClear();
  mockRegisterLinkProvider.mockClear();
  mockDefineTheme.mockClear();

  // Re-import to get a fresh module with languageRegistered = false
  const mod = await import("@/components/editor/TurtleEditor");
  TurtleEditor = mod.TurtleEditor;
});

describe("TurtleEditor", () => {
  it("renders the Monaco Editor", () => {
    render(<TurtleEditor value="" />);
    expect(screen.getByTestId("monaco-editor")).toBeDefined();
  });

  it("passes the Turtle language ID", () => {
    render(<TurtleEditor value="@prefix owl: <http://...> ." />);
    const editor = screen.getByTestId("monaco-editor");
    expect(editor.getAttribute("data-language")).toBe("turtle");
  });

  it("passes readOnly=false by default", () => {
    render(<TurtleEditor value="" />);
    const editor = screen.getByTestId("monaco-editor");
    expect(editor.getAttribute("data-readonly")).toBe("false");
  });

  it("passes readOnly=true when prop is set", () => {
    render(<TurtleEditor value="" readOnly />);
    const editor = screen.getByTestId("monaco-editor");
    expect(editor.getAttribute("data-readonly")).toBe("true");
  });

  it("sets correct Monaco options", () => {
    render(<TurtleEditor value="" minimap={false} lineNumbers fontSize={16} wordWrap="off" />);
    const options = capturedProps.options as Record<string, unknown>;
    expect(options.readOnly).toBe(false);
    expect((options.minimap as Record<string, unknown>).enabled).toBe(false);
    expect(options.lineNumbers).toBe("on");
    expect(options.wordWrap).toBe("off");
    expect(options.fontSize).toBe(16);
  });

  it("sets lineNumbers to 'off' when prop is false", () => {
    render(<TurtleEditor value="" lineNumbers={false} />);
    const options = capturedProps.options as Record<string, unknown>;
    expect(options.lineNumbers).toBe("off");
  });

  it("registers Turtle language via beforeMount", () => {
    render(<TurtleEditor value="" />);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ id: "turtle" })
    );
    expect(mockSetLanguageConfiguration).toHaveBeenCalled();
    expect(mockSetMonarchTokensProvider).toHaveBeenCalled();
  });

  it("registers completion and hover providers", () => {
    render(<TurtleEditor value="" />);
    expect(mockRegisterCompletionItemProvider).toHaveBeenCalled();
    expect(mockRegisterHoverProvider).toHaveBeenCalled();
    expect(mockRegisterLinkProvider).toHaveBeenCalled();
  });

  it("calls onReady with the editor instance on mount", () => {
    const onReady = vi.fn();
    render(<TurtleEditor value="" onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ getModel: expect.any(Function) })
    );
  });

  it("applies light theme by default (system preference)", () => {
    render(<TurtleEditor value="" />);
    expect(capturedProps.theme).toBe("vs");
  });

  it("applies dark theme when theme prop is 'dark'", () => {
    render(<TurtleEditor value="" theme="dark" />);
    expect(capturedProps.theme).toBe("vs-dark");
  });

  it("applies light theme when theme prop is 'light'", () => {
    render(<TurtleEditor value="" theme="light" />);
    expect(capturedProps.theme).toBe("vs");
  });

  it("wraps editor in a container with the given height", () => {
    const { container } = render(<TurtleEditor value="" height="600px" />);
    const wrapper = container.querySelector(".turtle-editor-container");
    expect(wrapper).toBeDefined();
    expect((wrapper as HTMLElement).style.height).toBe("600px");
  });

  it("uses default height of 400px", () => {
    const { container } = render(<TurtleEditor value="" />);
    const wrapper = container.querySelector(".turtle-editor-container");
    expect((wrapper as HTMLElement).style.height).toBe("400px");
  });

  it("passes onChange handler", () => {
    const onChange = vi.fn();
    render(<TurtleEditor value="" onChange={onChange} />);
    // The captured onChange on the editor props should be a function
    expect(typeof capturedProps.onChange).toBe("function");

    // Simulate calling it with a value
    (capturedProps.onChange as (v: string | undefined) => void)("new content");
    expect(onChange).toHaveBeenCalledWith("new content");
  });

  it("does not call onChange when value is undefined", () => {
    const onChange = vi.fn();
    render(<TurtleEditor value="" onChange={onChange} />);
    (capturedProps.onChange as (v: string | undefined) => void)(undefined);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sets performance-related options", () => {
    render(<TurtleEditor value="" />);
    const options = capturedProps.options as Record<string, unknown>;
    expect(options.scrollBeyondLastLine).toBe(false);
    expect(options.automaticLayout).toBe(true);
    expect(options.tabSize).toBe(2);
    expect(options.largeFileOptimizations).toBe(true);
    expect(options.links).toBe(true);
  });

  it("passes a loading spinner element", () => {
    render(<TurtleEditor value="" />);
    expect(capturedProps.loading).toBeDefined();
  });
});

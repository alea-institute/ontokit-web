import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTurtleSnippet } from '@/lib/ontology/turtleSnippetGenerator';
import type { TurtleDiagnostic, TurtleEditorProps } from '@/components/editor/TurtleEditor';

// Only the browser/editor boundary is replaced. Providers, namespace tables,
// snippet generation, event routing, and marker scheduling run production code.
const bridge = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@monaco-editor/react', () => ({
  default: (props: Record<string, unknown>) => { bridge.props = props; return null; },
  loader: { config: vi.fn() },
}));

type Position = { lineNumber: number; column: number };
type Hover = { contents: { value: string }[]; range: Record<string, number> } | null;
function textModel(source: string) {
  return {
    getValue: () => source,
    getLineContent: (line: number) => source.split('\n')[line - 1] ?? '',
    getLineCount: () => source.split('\n').length,
    getWordUntilPosition: () => ({ word: '', startColumn: 2, endColumn: 5 }),
    isDisposed: vi.fn(() => false),
  };
}
type Model = ReturnType<typeof textModel>;
type Mouse = { event: { ctrlKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }; target: { type: number; position?: Position } };
let TurtleEditor: typeof import('@/components/editor/TurtleEditor').TurtleEditor;
let mediaChange: (event: { matches: boolean }) => void;
let mediaRemove: ReturnType<typeof vi.fn>;
let monaco: ReturnType<typeof makeMonaco>;
function makeMonaco() {
  return {
    languages: {
      register: vi.fn(), setLanguageConfiguration: vi.fn(), setMonarchTokensProvider: vi.fn(),
      registerHoverProvider: vi.fn(), registerLinkProvider: vi.fn(), registerCompletionItemProvider: vi.fn(),
      CompletionItemKind: { Snippet: 1, Property: 2, Class: 3 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 1 },
    },
    editor: { setModelMarkers: vi.fn(), MouseTargetType: { GUTTER_GLYPH_MARGIN: 2 } },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  };
}
function mount(source = '', props: Partial<TurtleEditorProps> = {}, model: Model | null = textModel(source)) {
  const result = render(<TurtleEditor value={source} {...props} />);
  (bridge.props.beforeMount as (m: typeof monaco) => void)(monaco);
  let mouse!: (event: Mouse) => void;
  const editor = { getModel: () => model, onMouseDown: (handler: typeof mouse) => { mouse = handler; } };
  act(() => (bridge.props.onMount as (e: typeof editor, m: typeof monaco) => void)(editor, monaco));
  return {
    ...result, model, editor,
    click(lineNumber = 1, column = 1, options: { ctrlKey?: boolean; metaKey?: boolean; type?: number; missingPosition?: boolean } = {}) {
      const event = { ctrlKey: options.ctrlKey ?? true, metaKey: options.metaKey ?? false, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      act(() => mouse({ event, target: { type: options.type ?? 6, position: options.missingPosition ? undefined : { lineNumber, column } } }));
      return event;
    },
  };
}
function hover(model: Model, lineNumber: number, column: number): Hover {
  const provider = monaco.languages.registerHoverProvider.mock.calls[0][1] as { provideHover: (m: Model, p: Position) => Hover };
  return provider.provideHover(model, { lineNumber, column });
}
function links(model: Model) {
  const provider = monaco.languages.registerLinkProvider.mock.calls[0][1] as { provideLinks: (m: Model) => { links: { url: string; tooltip: string; range: Record<string, number> }[] } };
  return provider.provideLinks(model).links;
}
function diagnostic(severity: TurtleDiagnostic['severity'], message: string = severity): TurtleDiagnostic {
  return { startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5, severity, message };
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  monaco = makeMonaco();
  mediaRemove = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: (_name: string, handler: typeof mediaChange) => { mediaChange = handler; }, removeEventListener: mediaRemove })));
  vi.spyOn(window, 'open').mockImplementation(() => null);
  TurtleEditor = (await import('@/components/editor/TurtleEditor')).TurtleEditor;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('TurtleEditor production language providers', () => {
  it('integrates generated ontology snippets with completion, hover, and internal navigation', async () => {
    const namespace = 'https://example.org/ontology#';
    const iri = `${namespace}Customer`;
    const snippet = generateTurtleSnippet({ iri, label: 'Customer', entityType: 'class', ontologyPrefix: 'ex', ontologyNamespace: namespace });
    const source = `@prefix ex: <${namespace}> .\n${snippet}`;
    const navigate = vi.fn();
    const mounted = mount(source, { onInternalLinkClick: navigate, iriLabelMap: new Map([[iri, 'Customer']]) });
    const entityLine = source.split('\n').findIndex(line => line.startsWith('ex:Customer')) + 1;
    expect(entityLine).toBeGreaterThan(1);
    expect(hover(mounted.model!, entityLine, 4)?.contents).toEqual([
      { value: '**ex:Customer**' }, { value: 'Label: Customer' },
      { value: `Full IRI: \`${iri}\`` }, { value: '*Ctrl+Click to navigate to class*' },
    ]);
    mounted.click(entityLine, 4);
    expect(navigate).toHaveBeenCalledWith(iri);
    expect(window.open).not.toHaveBeenCalled();
    const language = await import('@/lib/editor/languages/turtle');
    expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalledWith('turtle', language.turtleLanguageConfiguration);
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith('turtle', language.turtleTokensProvider);
    const completion = monaco.languages.registerCompletionItemProvider.mock.calls[0][1] as { provideCompletionItems: (m: Model, p: Position) => { suggestions: { label: string; insertText: string; range: Record<string, number> }[] } };
    const suggestions = completion.provideCompletionItems(mounted.model!, { lineNumber: entityLine, column: 5 }).suggestions;
    expect(suggestions).toHaveLength(language.commonPrefixes.length + language.commonProperties.length + 3);
    for (const prefix of language.commonPrefixes) {
      expect(suggestions).toContainEqual(expect.objectContaining({ label: `@prefix ${prefix.prefix}:`, insertText: `@prefix ${prefix.prefix}: <${prefix.namespace}> .` }));
    }
    expect(suggestions.find(item => item.label === 'owl:Class')?.range).toEqual({ startLineNumber: entityLine, endLineNumber: entityLine, startColumn: 2, endColumn: 5 });
  });

  it.each([
    ['@base <https://example.org/> .\n<Person>', 2, 4, 'Full IRI: `https://example.org/Person`', 'navigate to class'],
    ['@prefix : <https://example.org/> .\n:Person', 2, 3, 'Full IRI: `https://example.org/Person`', 'navigate to class'],
    ['owl:Class', 1, 3, 'Full IRI: `http://www.w3.org/2002/07/owl#Class`', 'open in browser'],
    ['@prefix owl: <https://custom.org/> .\nowl:Class', 2, 3, 'Full IRI: `https://custom.org/Class`', 'navigate to class'],
    ['<https://external.org/Class>', 1, 4, '**<https://external.org/Class>**', 'open in browser'],
    ['@prefix ex: <https://example.org/> .\n<https://example.org/Person>', 2, 4, '**<https://example.org/Person>**', 'navigate to class'],
    ['@prefix ex: <https://example.org/> .\n<https://external.org/Person>', 2, 4, '**<https://external.org/Person>**', 'open in browser'],
    ['@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<http://www.w3.org/2002/07/owl#Class>', 2, 4, '**<http://www.w3.org/2002/07/owl#Class>**', 'open in browser'],
  ])('resolves hover namespaces in %s', (source, line, column, expected, action) => {
    const { model } = mount(source);
    const result = hover(model!, line, column);
    expect(result?.contents.map(item => item.value)).toContain(expected);
    expect(result?.contents.at(-1)?.value).toContain(action);
  });

  it.each(['<relative>', 'missing:Name', 'plain text', ''])('returns no hover for unresolved input %j', source => {
    const { model } = mount(source);
    expect(hover(model!, 1, 2)).toBeNull();
  });

  it('updates label cache on rerender and clears labels when the map is removed', () => {
    const source = '<https://example.org/A>';
    const view = mount(source, { iriLabelMap: new Map([['https://example.org/A', 'Old']]) });
    expect(hover(view.model!, 1, 3)?.contents).toContainEqual({ value: 'Label: Old' });
    view.rerender(<TurtleEditor value={source} iriLabelMap={new Map([['https://example.org/A', 'New']])} />);
    expect(hover(view.model!, 1, 3)?.contents).toContainEqual({ value: 'Label: New' });
    view.rerender(<TurtleEditor value={source} />);
    expect(hover(view.model!, 1, 3)?.contents).toHaveLength(2);
  });

  it('offers browser links only for external HTTP IRIs with precise ranges', () => {
    const source = '@base <https://base.org/> .\n@prefix ex: <https://internal.org/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<https://base.org/A> <https://internal.org/B> <https://external.org/C> <urn:thing> <relative>';
    const { model } = mount(source);
    const result = links(model!);
    expect(result.map(link => link.url)).toEqual(['http://www.w3.org/2002/07/owl#', 'https://external.org/C']);
    expect(result[1].tooltip).toBe('Ctrl+Click to open external.org');
    const line = source.split('\n')[3];
    expect(line.slice(result[1].range.startColumn - 1, result[1].range.endColumn - 1)).toBe(result[1].url);
    expect(links(textModel(''))).toEqual([]);
  });

  it.each(['<https://[invalid]>'])('ignores invalid external URLs while retaining valid links: %s', source => {
    const { model } = mount(source + ' <https://example.org/valid>');
    expect(links(model!).map(link => link.url)).toEqual(['https://example.org/valid']);
  });

  it('resolves the hovered token among several IRIs and prefixed names', () => {
    const source = '@base <https://base.org/> .\n@prefix ex: <https://internal.org/> .\n<https://external.org/A> <Relative> ex:First owl:Class';
    const { model } = mount(source);
    const line = model!.getLineContent(3);
    expect(hover(model!, 3, line.indexOf('<Relative>') + 3)?.contents).toContainEqual({ value: 'Full IRI: `https://base.org/Relative`' });
    expect(hover(model!, 3, line.indexOf('owl:Class') + 3)?.contents).toContainEqual({ value: 'Full IRI: `http://www.w3.org/2002/07/owl#Class`' });
    expect(hover(model!, 3, line.length + 2)).toBeNull();
  });

  it('registers providers once across two editor instances', () => {
    mount(''); mount('');
    expect(monaco.languages.register).toHaveBeenCalledTimes(1);
    expect(monaco.languages.registerHoverProvider).toHaveBeenCalledTimes(1);
  });
});

describe('TurtleEditor navigation and diagnostics', () => {
  it.each([
    ['@base <https://example.org/> .\n<Person>', 2, 4, 'https://example.org/Person'],
    ['@prefix ex: <https://example.org/> .\n<https://example.org/Person>', 2, 4, 'https://example.org/Person'],
    ['@prefix : <https://example.org/> .\n:Person', 2, 3, 'https://example.org/Person'],
  ])('routes internal links from %s and consumes the event', (source, line, column, iri) => {
    const navigate = vi.fn();
    const view = mount(source, { onInternalLinkClick: navigate });
    const event = view.click(line, column, { ctrlKey: false, metaKey: true });
    expect(navigate).toHaveBeenCalledWith(iri);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it.each([
    ['owl:Class', 'http://www.w3.org/2002/07/owl#Class'],
    ['<https://external.org/Class>', 'https://external.org/Class'],
    ['@prefix : <https://example.org/> .\n:Person', 'https://example.org/Person'],
  ])('opens a safe browser tab when navigation is external or no callback exists: %s', (source, iri) => {
    const view = mount(source);
    view.click(source.split('\n').length, 3);
    expect(window.open).toHaveBeenCalledWith(iri, '_blank', 'noopener,noreferrer');
  });

  it.each(['<relative>', 'unknown:Class', '<urn:thing>', '@prefix ex: <urn:example:> .\nex:Person', 'plain text'])('does not launch a browser for unresolved or non-HTTP links: %s', source => {
    const view = mount(source);
    view.click(source.split('\n').length, 3);
    expect(window.open).not.toHaveBeenCalled();
  });

  it('ignores unmodified clicks, missing positions, and absent models', () => {
    const view = mount('owl:Class');
    expect(view.click(1, 3, { ctrlKey: false }).preventDefault).not.toHaveBeenCalled();
    view.click(1, 3, { missingPosition: true });
    mount('', {}, null).click();
    expect(window.open).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
  });

  it('uses the latest internal navigation callback after rerender', () => {
    const old = vi.fn(); const current = vi.fn();
    const source = '@prefix ex: <https://example.org/> .\nex:Person';
    const view = mount(source, { onInternalLinkClick: old });
    view.rerender(<TurtleEditor value={source} onInternalLinkClick={current} />);
    view.click(2, 3);
    expect(old).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledWith('https://example.org/Person');
  });

  it('navigates the selected token among several full and prefixed IRIs', () => {
    const source = '@base <https://base.org/> .\n@prefix ex: <https://internal.org/> .\n<https://external.org/A> <Relative> ex:First owl:Class';
    const navigate = vi.fn();
    const view = mount(source, { onInternalLinkClick: navigate });
    const line = view.model!.getLineContent(3);
    view.click(3, line.indexOf('<Relative>') + 3);
    expect(navigate).toHaveBeenCalledWith('https://base.org/Relative');
    view.click(3, line.indexOf('owl:Class') + 3);
    expect(window.open).toHaveBeenCalledWith('http://www.w3.org/2002/07/owl#Class', '_blank', 'noopener,noreferrer');
    expect(view.click(3, line.length + 2).preventDefault).not.toHaveBeenCalled();
  });

  it('reads edited document namespaces on each click instead of caching the initial text', () => {
    const model = textModel('@prefix ex: <https://old.org/> .\nex:Person');
    const navigate = vi.fn();
    const view = mount('', { onInternalLinkClick: navigate }, model);
    view.click(2, 3);
    model.getValue = () => '@prefix ex: <https://new.org/> .\nex:Person';
    view.click(2, 3);
    expect(navigate.mock.calls).toEqual([['https://old.org/Person'], ['https://new.org/Person']]);
  });

  it('cancels a stale deferred marker update when diagnostics change before its deadline', () => {
    const old = diagnostic('error', 'old');
    const current = diagnostic('warning', 'current');
    const view = mount('', { diagnostics: [old] });
    act(() => vi.advanceTimersByTime(50));
    view.rerender(<TurtleEditor value="" diagnostics={[current]} />);
    act(() => vi.advanceTimersByTime(100));
    expect(monaco.editor.setModelMarkers.mock.calls.map(call => call[2])).toEqual([
      [], [{ ...current, severity: 4 }],
    ]);
  });

  it('selects a diagnostic spanning a gutter line and ignores missing/outside positions', () => {
    const onDiagnosticClick = vi.fn();
    const item = diagnostic('warning');
    const view = mount('', { diagnostics: [item], onDiagnosticClick });
    view.click(3, 1, { ctrlKey: false, type: 2 });
    expect(onDiagnosticClick).toHaveBeenCalledWith(item);
    view.click(5, 1, { ctrlKey: false, type: 2 });
    view.click(3, 1, { ctrlKey: false, type: 2, missingPosition: true });
    expect(onDiagnosticClick).toHaveBeenCalledOnce();
  });

  it('uses diagnostics and the callback received after Monaco mounted', () => {
    const oldCallback = vi.fn();
    const currentCallback = vi.fn();
    const item = diagnostic('warning');
    const view = mount('', { diagnostics: [], onDiagnosticClick: oldCallback });
    view.rerender(<TurtleEditor value="" diagnostics={[item]} onDiagnosticClick={currentCallback} />);
    view.click(3, 1, { ctrlKey: false, type: 2 });
    expect(currentCallback).toHaveBeenCalledExactlyOnceWith(item);
    expect(oldCallback).not.toHaveBeenCalled();
    view.rerender(<TurtleEditor value="" diagnostics={[]} onDiagnosticClick={currentCallback} />);
    view.click(3, 1, { ctrlKey: false, type: 2 });
    expect(currentCallback).toHaveBeenCalledOnce();
  });

  it('defers severity-correct markers and clears them when diagnostics are removed', () => {
    const diagnostics = (['error', 'warning', 'info', 'hint'] as const).map(severity => diagnostic(severity));
    const view = mount('', { diagnostics });
    expect(monaco.editor.setModelMarkers).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    const markers = monaco.editor.setModelMarkers.mock.calls[0][2];
    expect(markers.map((marker: { severity: number }) => marker.severity)).toEqual([8, 4, 2, 1]);
    expect(markers[0]).toEqual({ ...diagnostics[0], severity: 8 });
    view.rerender(<TurtleEditor value="" diagnostics={[]} />);
    act(() => vi.advanceTimersByTime(100));
    expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(view.model, 'turtle-linter', []);
  });

  it('caps a large diagnostic set at 200, retaining errors before hints without mutating input', () => {
    const diagnostics = [...Array.from({ length: 205 }, (_, i) => diagnostic('hint', `hint ${i}`)), diagnostic('error', 'critical'), diagnostic('warning', 'warning')];
    mount('', { diagnostics });
    act(() => vi.advanceTimersByTime(100));
    const markers = monaco.editor.setModelMarkers.mock.calls[0][2];
    expect(markers).toHaveLength(200);
    expect(markers.slice(0, 2).map((marker: { message: string }) => marker.message)).toEqual(['critical', 'warning']);
    expect(diagnostics[0].message).toBe('hint 0');
    expect(diagnostics).toHaveLength(207);
  });

  it('does not set markers after the model is disposed', () => {
    const view = mount('', { diagnostics: [diagnostic('error')] });
    view.model!.isDisposed.mockReturnValue(true);
    act(() => vi.advanceTimersByTime(100));
    view.unmount();
    expect(monaco.editor.setModelMarkers).not.toHaveBeenCalled();
  });

  it('cancels pending markers and clears live model markers on unmount', () => {
    const view = mount('', { diagnostics: [diagnostic('error')] });
    view.unmount();
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledExactlyOnceWith(view.model, 'turtle-linter', []);
    act(() => vi.advanceTimersByTime(100));
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledTimes(1);
  });

  it('starts with a dark system preference and restores it when an explicit override is removed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: (_name: string, handler: typeof mediaChange) => { mediaChange = handler; }, removeEventListener: mediaRemove })));
    const view = mount();
    expect(bridge.props.theme).toBe('vs-dark');
    view.rerender(<TurtleEditor value="" theme="light" />);
    expect(bridge.props.theme).toBe('vs');
    view.rerender(<TurtleEditor value="" />);
    expect(bridge.props.theme).toBe('vs-dark');
    act(() => mediaChange({ matches: false }));
    expect(bridge.props.theme).toBe('vs');
    view.unmount();
    expect(mediaRemove).toHaveBeenCalledWith('change', mediaChange);
  });

  it('responds to theme preference changes, honors override, and removes listener', () => {
    const view = mount('');
    act(() => mediaChange({ matches: true }));
    expect(bridge.props.theme).toBe('vs-dark');
    view.rerender(<TurtleEditor value="" theme="light" />);
    expect(bridge.props.theme).toBe('vs');
    act(() => mediaChange({ matches: false }));
    view.unmount();
    expect(mediaRemove).toHaveBeenCalledWith('change', mediaChange);
  });
});

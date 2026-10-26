import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntitySourcePreview, type EntitySourcePreviewProps } from "@/components/editor/EntitySourcePreview";
import * as entitySource from "@/lib/ontology/entitySource";

const iri = "https://example.org/Person";
const source = `@prefix ex: <https://example.org/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .`;
const props = (overrides: Partial<EntitySourcePreviewProps> = {}): EntitySourcePreviewProps => ({
  iri, sourceContent: source, filePath: "folio.ttl", isLoading: false, isReady: true,
  error: null, onRetry: vi.fn(), onOpenFullSource: vi.fn(), ...overrides,
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("entity source preview", () => {
  it("copies exactly the displayed file/line comments and excerpts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const p = props(); render(<EntitySourcePreview {...p} />);
    expect(screen.getByText(iri)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Copy snippet" }));
    expect(await screen.findByText("Snippet copied")).toBeDefined();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('# File: folio.ttl, line 2\nex:Person a <http://www.w3.org/2002/07/owl#Class> .');
    fireEvent.click(screen.getByRole("button", { name: "Open full source" }));
    expect(p.onOpenFullSource).toHaveBeenCalledExactlyOnceWith(iri);
  });

  it("distinguishes selection, loading, failure/retry and unavailable source", async () => {
    const p = props({ iri: null }); const { rerender } = render(<EntitySourcePreview {...p} />);
    expect(screen.getByText(/Select an entity/)).toBeDefined();
    rerender(<EntitySourcePreview {...p} iri={iri} isLoading />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByRole("button", { name: "Copy snippet" })).toBeNull();
    rerender(<EntitySourcePreview {...p} iri={iri} error="Network failure" />);
    expect(screen.getByRole("alert").textContent).toContain("Network failure");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(p.onRetry).toHaveBeenCalledOnce();
    rerender(<EntitySourcePreview {...p} iri={iri} sourceContent="" />);
    expect(await screen.findByText(/No direct statements/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Open full source" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Copy snippet" })).toBeNull();
  });

  it("reports clipboard denial and ignores a completion after selection changes", async () => {
    let finish!: () => void;
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { rerender } = render(<EntitySourcePreview {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy snippet" }));
    expect(await screen.findByText(/Could not copy/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Copy snippet" }));
    rerender(<EntitySourcePreview {...props({ iri: "https://example.org/Other" })} />);
    await act(async () => { finish(); });
    expect(screen.queryByText("Snippet copied")).toBeNull();
    expect(screen.queryByText(/Could not copy/)).toBeNull();
  });

  it("suppresses old source until the current scope is ready", () => {
    render(<EntitySourcePreview {...props({ isReady: false })} />);
    expect(screen.queryByRole("button", { name: "Copy snippet" })).toBeNull();
    expect(screen.queryByText(/ex:Person a/)).toBeNull();
  });

  it("reuses one source index when the selected IRI changes", async () => {
    const build = vi.spyOn(entitySource, "buildEntitySourceIndex");
    const sourceContent = source + '\nex:Other <urn:label> "Other entity" .';
    const p = props({ sourceContent });
    const { rerender } = render(<EntitySourcePreview {...p} />);
    expect((await screen.findByLabelText("Source excerpts")).textContent).toContain("ex:Person a");
    rerender(<EntitySourcePreview {...p} iri="https://example.org/Other" />);
    expect(screen.getByLabelText("Source excerpts").textContent).toContain("Other entity");
    expect(screen.getByLabelText("Source excerpts").textContent).not.toContain("ex:Person a");
    rerender(<EntitySourcePreview {...p} />);
    expect(screen.getByLabelText("Source excerpts").textContent).toContain("ex:Person a");
    expect(build).toHaveBeenCalledOnce();
  });

  it("hides old excerpts immediately and ignores a cancelled source build", async () => {
    const oldIndex = await entitySource.buildEntitySourceIndex(source);
    const newSource = source.replace("ex:Person a", 'ex:Person <urn:label> "New buffer" ; a');
    let finishOld!: (index: entitySource.EntitySourceIndex | null) => void;
    let oldSignal: AbortSignal | undefined;
    vi.spyOn(entitySource, "buildEntitySourceIndex").mockImplementationOnce((_source, signal) => {
      oldSignal = signal;
      return new Promise(resolve => { finishOld = resolve; });
    });
    const { rerender } = render(<EntitySourcePreview {...props()} />);
    expect(screen.getByRole("status").textContent).toContain("Preparing");
    rerender(<EntitySourcePreview {...props({ sourceContent: newSource })} />);
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByLabelText("Source excerpts")).toBeNull();
    expect((await screen.findByLabelText("Source excerpts")).textContent).toContain("New buffer");
    await act(async () => { finishOld(oldIndex); });
    expect(screen.getByLabelText("Source excerpts").textContent).toContain("New buffer");
    rerender(<EntitySourcePreview {...props({ sourceContent: source })} />);
    expect(screen.queryByLabelText("Source excerpts")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy snippet" })).toBeNull();
    expect((await screen.findByLabelText("Source excerpts")).textContent).not.toContain("New buffer");
  });

  it("cancels an in-flight index when the preview unmounts", () => {
    let signal: AbortSignal | undefined;
    vi.spyOn(entitySource, "buildEntitySourceIndex").mockImplementation((_source, nextSignal) => {
      signal = nextSignal;
      return new Promise(() => {});
    });
    const { unmount } = render(<EntitySourcePreview {...props()} />);
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("uses the latest selection when a shared source build completes", async () => {
    const sourceContent = source + '\nex:Other <urn:label> "Other entity" .';
    const index = await entitySource.buildEntitySourceIndex(sourceContent);
    let finish!: (index: entitySource.EntitySourceIndex | null) => void;
    const build = vi.spyOn(entitySource, "buildEntitySourceIndex").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const p = props({ sourceContent });
    const { rerender } = render(<EntitySourcePreview {...p} />);
    rerender(<EntitySourcePreview {...p} iri="https://example.org/Other" />);
    expect(screen.queryByLabelText("Source excerpts")).toBeNull();
    await act(async () => { finish(index); });
    expect(screen.getByLabelText("Source excerpts").textContent).toContain("Other entity");
    expect(screen.getByLabelText("Source excerpts").textContent).not.toContain("ex:Person a");
    expect(build).toHaveBeenCalledOnce();
  });
});

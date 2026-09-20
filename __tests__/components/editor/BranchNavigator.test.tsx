import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchNavigator } from "@/components/editor/BranchNavigator";
import type { ClassTreeNode } from "@/lib/ontology/types";

const node = (iri: string, children: ClassTreeNode[] = []): ClassTreeNode => ({
  iri, label: iri, children, isExpanded: true, isLoading: false,
  hasChildren: children.length > 0,
});
const roots = [node("root-a"), node("root-b", [node("parent", [node("a"), node("b"), node("c")])])];
const next = () => screen.getByRole("button", { name: "Next class in branch" });
const previous = () => screen.getByRole("button", { name: "Previous class in branch" });

function Harness({ initial = "a", suggest = vi.fn() }: { initial?: string; suggest?: (iri: string) => void }) {
  const [selected, setSelected] = useState(initial);
  return <><output>{selected}</output><BranchNavigator nodes={roots} selectedIri={selected} onNavigate={setSelected} autoSuggestOnNavigate onAutoSuggest={suggest} /></>;
}

describe("BranchNavigator real tree navigation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("finds nested siblings and follows controlled selection through both boundaries", () => {
    render(<Harness />);
    expect((previous() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("b");
    fireEvent.click(next());
    expect((next() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("3 / 3")).toBeTruthy();
    fireEvent.click(previous());
    expect(screen.getByRole("status").textContent).toBe("b");
  });

  it("debounces rapid navigation and suggests only the last selected sibling", () => {
    const suggest = vi.fn();
    render(<Harness suggest={suggest} />);
    fireEvent.click(next());
    act(() => vi.advanceTimersByTime(799));
    expect(suggest).not.toHaveBeenCalled();
    fireEvent.click(next());
    act(() => vi.advanceTimersByTime(799));
    expect(suggest).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(suggest).toHaveBeenCalledExactlyOnceWith("c");
    fireEvent.click(previous());
    act(() => vi.advanceTimersByTime(800));
    expect(suggest).toHaveBeenLastCalledWith("b");
  });

  it("cancels an already queued suggestion as soon as it is disabled", () => {
    const suggest = vi.fn();
    const view = render(<BranchNavigator nodes={roots} selectedIri="a" onNavigate={vi.fn()} autoSuggestOnNavigate onAutoSuggest={suggest} />);
    fireEvent.click(next());
    view.rerender(<BranchNavigator nodes={roots} selectedIri="b" onNavigate={vi.fn()} autoSuggestOnNavigate={false} onAutoSuggest={suggest} />);
    act(() => vi.advanceTimersByTime(800));
    expect(suggest).not.toHaveBeenCalled();
  });

  it("cancels pending suggestions on unmount", () => {
    const suggest = vi.fn();
    const view = render(<Harness suggest={suggest} />);
    fireEvent.click(next());
    view.unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(suggest).not.toHaveBeenCalled();
  });

  it("uses root siblings when the selection has no parent", () => {
    render(<Harness initial="root-a" />);
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("root-b");
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  it("prioritizes a flat property list over class nodes", () => {
    const navigate = vi.fn();
    render(<BranchNavigator nodes={roots} simpleNodes={[{ iri: "p1", label: "First" }, { iri: "p2", label: "Second" }]} selectedIri="p2" onNavigate={navigate} />);
    fireEvent.click(previous());
    expect(navigate).toHaveBeenCalledExactlyOnceWith("p1");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to class siblings for an empty flat list", () => {
    render(<BranchNavigator nodes={roots} simpleNodes={[]} selectedIri="b" onNavigate={vi.fn()} />);
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it.each([
    { nodes: roots, selectedIri: null },
    { nodes: [], selectedIri: "a" },
    { nodes: roots, selectedIri: "missing" },
    { nodes: roots, selectedIri: "parent" },
    { nodes: roots, selectedIri: null, simpleNodes: [{ iri: "p1", label: "one" }, { iri: "p2", label: "two" }] },
  ])("hides unavailable navigation %#", (props) => {
    const { container } = render(<BranchNavigator {...props} onNavigate={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("cancels an earlier suggestion when suggestions are disabled before the next navigation", () => {
    const suggest = vi.fn();
    const navigate = vi.fn();
    const view = render(<BranchNavigator nodes={roots} selectedIri="b" onNavigate={navigate} autoSuggestOnNavigate onAutoSuggest={suggest} />);
    fireEvent.click(next());
    view.rerender(<BranchNavigator nodes={roots} selectedIri="c" onNavigate={navigate} onAutoSuggest={suggest} />);
    fireEvent.click(previous());
    act(() => vi.advanceTimersByTime(800));
    expect(suggest).not.toHaveBeenCalled();
    expect(navigate.mock.calls).toEqual([["c"], ["b"]]);
  });

  it("allows navigation when auto-suggest is enabled without a callback", () => {
    const navigate = vi.fn();
    render(<BranchNavigator nodes={roots} selectedIri="b" onNavigate={navigate} autoSuggestOnNavigate />);
    fireEvent.click(previous());
    expect(navigate).toHaveBeenCalledExactlyOnceWith("a");
    expect(vi.getTimerCount()).toBe(0);
  });
});

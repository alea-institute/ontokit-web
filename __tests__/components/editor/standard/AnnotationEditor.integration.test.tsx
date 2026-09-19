import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AnnotationEditor } from "@/components/editor/standard/AnnotationEditor";
import type { AnnotationUpdate } from "@/lib/api/client";

const initial: AnnotationUpdate[] = [{ property_iri: "http://www.w3.org/2000/01/rdf-schema#comment", values: [{ value: "Existing comment", lang: "en" }] }];
afterEach(cleanup);
function mount() {
  const changed = vi.fn();
  function Harness() {
    const [annotations, setAnnotations] = useState(initial);
    return <AnnotationEditor annotations={annotations} onChange={next => { changed(next); setAnnotations(next); }} />;
  }
  render(<Harness />);
  return changed;
}

describe("annotation editor with its real property registry and annotation rows", () => {
  it.each(["Escape", "outside"])("dismisses the picker via %s without changing existing annotations", method => {
    const changed = mount();
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    const search = screen.getByPlaceholderText("Search annotation properties...");
    fireEvent.change(search, { target: { value: "no-such-property" } });
    expect(screen.getByText("No matching properties")).toBeDefined();
    if (method === "Escape") fireEvent.keyDown(search, { key: "Escape" });
    else fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText("Search annotation properties...")).toBeNull();
    expect((screen.getByRole("textbox", { name: "comment value" }) as HTMLInputElement).value).toBe("Existing comment");
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    expect((screen.getByPlaceholderText("Search annotation properties...") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("No matching properties")).toBeNull();
  });

  it("adds, edits and removes a registry-selected annotation without losing existing values", () => {
    const changed = mount();
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    fireEvent.change(screen.getByPlaceholderText("Search annotation properties..."), { target: { value: "skos:definition" } });
    fireEvent.click(screen.getByRole("button", { name: /Definition.*skos:definition/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Definition value" }), { target: { value: "A precise definition" } });
    expect(changed).toHaveBeenLastCalledWith([...initial, {
      property_iri: "http://www.w3.org/2004/02/skos/core#definition", values: [{ value: "A precise definition", lang: "en" }],
    }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Definition annotation" }));
    expect(changed).toHaveBeenLastCalledWith(initial);
    expect(screen.queryByRole("textbox", { name: "Definition value" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "comment value" }) as HTMLInputElement).value).toBe("Existing comment");
  });
});

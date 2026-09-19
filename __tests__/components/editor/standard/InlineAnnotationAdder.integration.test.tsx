import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InlineAnnotationAdder } from "@/components/editor/standard/InlineAnnotationAdder";
import { ANNOTATION_PROPERTIES } from "@/lib/ontology/annotationProperties";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import type { AnnotationUpdate } from "@/lib/api/client";
import { TURTLE_FIXTURE } from "../../../lib/ontology/fixtures";

const iri = "http://example.org/ont#Dog";
const definitionIri = "http://www.w3.org/2004/02/skos/core#definition";
const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
function Editor({ excluded = [] }: { excluded?: string[] }) {
  const [annotations, setAnnotations] = useState<AnnotationUpdate[]>([]);
  const [source, setSource] = useState(TURTLE_FIXTURE);
  const [saves, setSaves] = useState(0);
  return <>
    <InlineAnnotationAdder excludeIris={[...excluded, ...annotations.map(item => item.property_iri)]}
      onAdd={(property_iri, value, lang) => {
        const next = [...annotations, { property_iri, values: [{ value, lang }] }];
        setAnnotations(next);
        setSource(updateClassInTurtle(source, iri, { labels: [{ value: "Dog", lang: "en" }], comments: [], parent_iris: [], annotations: next }));
      }} onSaveNeeded={() => setSaves(count => count + 1)} />
    <output aria-label="Saved Turtle">{source}</output><output>{saves} saves</output>
  </>;
}
async function selectDefinition() {
  fireEvent.focus(screen.getByLabelText("Select annotation property"));
  fireEvent.click(screen.getByRole("button", { name: /Definition\s*skos:definition/ }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Annotation value")));
}
const triples = () => parseBlockTriples(screen.getByLabelText("Saved Turtle").textContent!, iri);
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (scrollDescriptor) Object.defineProperty(Element.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe("inline annotation entry with real language selection and Turtle persistence", () => {
  it("writes the chosen French language and resets the form after Enter", async () => {
    const lang = "fr";
    render(<Editor />); await selectDefinition();
    fireEvent.click(screen.getByRole("button", { name: "Language tag" }));
    fireEvent.change(screen.getByPlaceholderText("Search languages..."), { target: { value: lang } });
    fireEvent.click(await screen.findByRole("option", { name: /French\s*Français\s*fr$/ }));
    const input = screen.getByLabelText("Annotation value");
    fireEvent.change(input, { target: { value: "  A quoted \"definition\"  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(triples()).toContainEqual({ predicate: definitionIri, object: { type: "literal", value: 'A quoted "definition"', lang } });
    expect(screen.getByText("1 saves")).toBeDefined();
    expect((screen.getByLabelText("Annotation value") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Language tag" }).textContent).toContain("en");
    fireEvent.focus(screen.getByLabelText("Select annotation property"));
    expect(screen.queryByRole("button", { name: /Definition\s*skos:definition/ })).toBeNull();
  });

  it("keeps an empty value unsaved, then commits on blur without duplicating the annotation", async () => {
    render(<Editor />); await selectDefinition();
    const input = screen.getByLabelText("Annotation value");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" }); fireEvent.blur(input);
    expect(screen.getByText("0 saves")).toBeDefined();
    expect(screen.getByLabelText("Saved Turtle").textContent).toBe(TURTLE_FIXTURE);
    fireEvent.change(input, { target: { value: "Saved on blur" } }); fireEvent.blur(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(triples()?.filter(triple => triple.predicate === definitionIri)).toEqual([
      { predicate: definitionIri, object: { type: "literal", value: "Saved on blur", lang: "en" } },
    ]);
    expect(screen.getByText("1 saves")).toBeDefined();
  });

  it("dismisses and reopens filtered properties without saving an annotation", async () => {
    render(<Editor />); await selectDefinition();
    fireEvent.click(screen.getByRole("button", { name: "Definition" }));
    fireEvent.change(screen.getByPlaceholderText("Filter properties..."), { target: { value: "no-such-vocabulary" } });
    expect(screen.getByText("No matching properties")).toBeDefined();
    fireEvent.keyDown(screen.getByPlaceholderText("Filter properties..."), { key: "Escape" });
    expect(screen.queryByPlaceholderText("Filter properties...")).toBeNull();
    fireEvent.change(screen.getByLabelText("Select annotation property"), { target: { value: "skos:definition" } });
    expect(screen.getByRole("button", { name: /Definition\s*skos:definition/ })).toBeDefined();
    fireEvent.mouseDown(screen.getByLabelText("Select annotation property"));
    expect(screen.getByPlaceholderText("Filter properties...")).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText("Filter properties...")).toBeNull();
    expect(screen.getByText("0 saves")).toBeDefined();
  });

  it("offers no duplicate properties when the parent excludes the whole vocabulary", () => {
    render(<Editor excluded={ANNOTATION_PROPERTIES.map(property => property.iri)} />);
    fireEvent.focus(screen.getByLabelText("Select annotation property"));
    expect(screen.getByText("No matching properties")).toBeDefined();
    expect((screen.getByLabelText("Annotation value") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("0 saves")).toBeDefined();
  });
});

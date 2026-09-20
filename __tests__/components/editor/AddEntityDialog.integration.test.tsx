import { useState, type ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AddEntityDialog, type NewEntityInfo } from "@/components/editor/AddEntityDialog";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";

const ns = "https://example.test/entities#";
const prefixes = '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n';
function setup(props: Partial<ComponentProps<typeof AddEntityDialog>> = {}) {
  const entities: NewEntityInfo[] = [];
  let source = prefixes;
  function Harness() {
    const [open, setOpen] = useState(true);
    return <>
      <button onClick={() => setOpen(true)}>Add another</button>
      <AddEntityDialog open={open} onOpenChange={setOpen} iriPattern="named" ontologyNamespace={ns}
        onConfirm={entity => { source += generateTurtleSnippet(entity); entities.push(entity); }} {...props} />
    </>;
  }
  render(<Harness />);
  return { entities, triples: (iri: string) => parseBlockTriples(source, iri) };
}
afterEach(cleanup);

describe("entity dialog through IRI generation and Turtle serialization", () => {
  it.each([undefined, 42])("creates a numeric subclass with next index %s", async nextNumeric => {
    const user = userEvent.setup();
    const result = setup({ iriPattern: "numeric", nextNumeric, parentIri: ns + "Parent" });
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    const iri = ns + (nextNumeric ?? 1);
    expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(iri);
    await user.type(screen.getByLabelText("Label"), "  Child label  ");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(result.entities).toEqual([{ iri, label: "Child label", entityType: "class", parentIri: ns + "Parent" }]);
    expect(result.triples(iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: ns + "Parent" } });
    expect(result.triples(iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Child label", lang: "en" } });
  });

  it("keeps a UUID stable while editing and creates a fresh identifier after reopening", async () => {
    const user = userEvent.setup();
    const result = setup({ iriPattern: "uuid" });
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    const first = (screen.getByLabelText("IRI") as HTMLInputElement).value;
    expect(first.slice(ns.length)).toMatch(/^R[0-9A-Za-z]+$/);
    await user.type(screen.getByLabelText("Label"), "First");
    expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(first);
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("button", { name: "Add another" }));
    expect((screen.getByLabelText("Label") as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    const second = (screen.getByLabelText("IRI") as HTMLInputElement).value;
    expect(second).not.toBe(first);
    await user.type(screen.getByLabelText("Label"), "Second");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(result.entities.map(entity => entity.iri)).toEqual([first, second]);
    expect(result.triples(first)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "First", lang: "en" } });
  });

  it("preserves a manually chosen IRI when a named property label changes", async () => {
    const user = userEvent.setup();
    const result = setup();
    await user.type(screen.getByLabelText("Label"), "has-part");
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect((screen.getByLabelText("IRI") as HTMLInputElement).value).toBe(ns + "HasPart");
    await user.clear(screen.getByLabelText("IRI"));
    await user.type(screen.getByLabelText("IRI"), ns + "custom");
    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Related object");
    await user.selectOptions(screen.getByLabelText("Type"), "objectProperty");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(result.entities[0]).toMatchObject({ iri: ns + "custom", label: "Related object", entityType: "objectProperty" });
    expect(result.triples(ns + "custom")).toContainEqual({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: { type: "iri", value: "http://www.w3.org/2002/07/owl#ObjectProperty" } });
  });

  it("rejects empty manual IRIs and allows correction without losing the label", async () => {
    const user = userEvent.setup();
    const result = setup();
    await user.type(screen.getByLabelText("Label"), "Kept label");
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.clear(screen.getByLabelText("IRI"));
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(result.entities).toEqual([]);
    expect((screen.getByLabelText("Label") as HTMLInputElement).value).toBe("Kept label");
    await user.type(screen.getByLabelText("IRI"), ns + "corrected");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(result.triples(ns + "corrected")).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Kept label", lang: "en" } });
  });
});

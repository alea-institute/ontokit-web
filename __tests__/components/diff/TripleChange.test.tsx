import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TripleChange,
  SemanticDiff,
} from "@/components/diff/TripleChange";
import type { TripleChange as TripleChangeType } from "@/lib/api/revisions";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Plus: (props: Record<string, unknown>) => <span data-testid="plus-icon" {...props} />,
  Minus: (props: Record<string, unknown>) => <span data-testid="minus-icon" {...props} />,
}));

const addedTriple: TripleChangeType = {
  subject: "http://example.org/ontology#MyClass",
  predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  object: "http://www.w3.org/2002/07/owl#Class",
  change_type: "added",
};

const removedTriple: TripleChangeType = {
  subject: "http://example.org/ontology#OldClass",
  predicate: "http://www.w3.org/2000/01/rdf-schema#label",
  object: "Old Class",
  change_type: "removed",
};

describe("TripleChange", () => {
  it("renders an added triple with green styling", () => {
    const { container } = render(<TripleChange change={addedTriple} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain("border-green-200");
    expect(screen.getByTestId("plus-icon")).toBeDefined();
  });

  it("renders a removed triple with red styling", () => {
    const { container } = render(<TripleChange change={removedTriple} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain("border-red-200");
    expect(screen.getByTestId("minus-icon")).toBeDefined();
  });

  it("shortens well-known IRI prefixes", () => {
    render(<TripleChange change={addedTriple} />);
    expect(screen.getByText("rdf:type")).toBeDefined();
    expect(screen.getByText("owl:Class")).toBeDefined();
  });

  it("shortens rdfs prefix", () => {
    render(<TripleChange change={removedTriple} />);
    expect(screen.getByText("rdfs:label")).toBeDefined();
  });

  it("renders literal objects with title attribute", () => {
    render(<TripleChange change={removedTriple} />);
    expect(screen.getByTitle("Old Class")).toBeDefined();
  });

  it("renders IRI objects with angle brackets", () => {
    render(<TripleChange change={addedTriple} />);
    const angleBrackets = screen.getAllByText((content) =>
      content === "<" || content === ">",
    );
    expect(angleBrackets.length).toBeGreaterThanOrEqual(2);
  });

  it("applies custom className", () => {
    const { container } = render(
      <TripleChange change={addedTriple} className="my-custom" />,
    );
    expect(container.firstElementChild!.className).toContain("my-custom");
  });

  it("shortens skos prefix", () => {
    const triple: TripleChangeType = {
      subject: "http://example.org/ontology#X",
      predicate: "http://www.w3.org/2004/02/skos/core#prefLabel",
      object: "Label",
      change_type: "added",
    };
    render(<TripleChange change={triple} />);
    expect(screen.getByText("skos:prefLabel")).toBeDefined();
  });
});

describe("SemanticDiff", () => {
  it("renders empty state when no changes", () => {
    render(<SemanticDiff added={[]} removed={[]} />);
    expect(
      screen.getByText("No semantic changes detected"),
    ).toBeDefined();
  });

  it("renders summary counts", () => {
    render(
      <SemanticDiff added={[addedTriple]} removed={[removedTriple]} />,
    );
    expect(screen.getByText("1 added")).toBeDefined();
    expect(screen.getByText("1 removed")).toBeDefined();
  });

  it("renders Added section heading when triples are added", () => {
    render(<SemanticDiff added={[addedTriple]} removed={[]} />);
    expect(screen.getByText("Added")).toBeDefined();
  });

  it("renders Removed section heading when triples are removed", () => {
    render(<SemanticDiff added={[]} removed={[removedTriple]} />);
    expect(screen.getByText("Removed")).toBeDefined();
  });

  it("renders both sections with multiple triples", () => {
    render(
      <SemanticDiff
        added={[addedTriple, addedTriple]}
        removed={[removedTriple]}
      />,
    );
    expect(screen.getByText("2 added")).toBeDefined();
    expect(screen.getByText("1 removed")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SemanticDiff
        added={[addedTriple]}
        removed={[]}
        className="diff-wrapper"
      />,
    );
    expect(container.firstElementChild!.className).toContain("diff-wrapper");
  });
});

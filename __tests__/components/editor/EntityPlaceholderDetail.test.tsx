import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntityPlaceholderDetail } from "@/components/editor/EntityPlaceholderDetail";

describe("EntityPlaceholderDetail", () => {
  it("renders placeholder when selectedIri is null", () => {
    render(<EntityPlaceholderDetail selectedIri={null} entityType="Class" />);
    expect(screen.getByText("Select a class to view its details")).toBeDefined();
  });

  it("renders placeholder for Property type (lowercased)", () => {
    render(<EntityPlaceholderDetail selectedIri={null} entityType="Property" />);
    expect(screen.getByText("Select a property to view its details")).toBeDefined();
  });

  it("renders entity details when selectedIri is provided", () => {
    render(
      <EntityPlaceholderDetail
        selectedIri="http://example.org/ontology#Person"
        entityType="Class"
      />
    );
    expect(screen.getByText("Person")).toBeDefined();
    expect(screen.getByText("http://example.org/ontology#Person")).toBeDefined();
  });

  it("renders first letter badge for Class type", () => {
    render(
      <EntityPlaceholderDetail
        selectedIri="http://example.org/ontology#Person"
        entityType="Class"
      />
    );
    expect(screen.getByText("C")).toBeDefined();
  });

  it("renders first letter badge for Property type", () => {
    render(
      <EntityPlaceholderDetail
        selectedIri="http://example.org/ontology#hasName"
        entityType="Property"
      />
    );
    expect(screen.getByText("P")).toBeDefined();
  });

  it("shows future update message when entity is selected", () => {
    render(
      <EntityPlaceholderDetail
        selectedIri="http://example.org/ontology#Person"
        entityType="Class"
      />
    );
    expect(
      screen.getByText("Class detail editing will be available in a future update.")
    ).toBeDefined();
  });
});

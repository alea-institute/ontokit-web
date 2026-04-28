import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ViewerEditorSwitcher } from "@/components/editor/ViewerEditorSwitcher";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>
      {children as React.ReactNode}
    </a>
  ),
}));

let mockPathname = "/projects/proj-1";
let mockSearch = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

describe("ViewerEditorSwitcher", () => {
  beforeEach(() => {
    mockPathname = "/projects/proj-1";
    mockSearch = "";
  });

  it("renders both segments with their labels", () => {
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    expect(screen.getByText("Viewer")).toBeDefined();
    expect(screen.getByText("Editor")).toBeDefined();
  });

  it("marks Viewer as active when on the viewer route", () => {
    mockPathname = "/projects/proj-1";
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    // The active segment renders as a non-link <span aria-current="page">
    const viewerSegment = screen.getByText("Viewer").parentElement;
    expect(viewerSegment?.getAttribute("aria-current")).toBe("page");

    // Editor segment is a clickable link
    const editorLink = screen.getByText("Editor").closest("a");
    expect(editorLink).not.toBeNull();
    expect(editorLink?.getAttribute("href")).toBe("/projects/proj-1/editor");
  });

  it("marks Editor as active when on the editor route", () => {
    mockPathname = "/projects/proj-1/editor";
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorSegment = screen.getByText("Editor").parentElement;
    expect(editorSegment?.getAttribute("aria-current")).toBe("page");

    const viewerLink = screen.getByText("Viewer").closest("a");
    expect(viewerLink).not.toBeNull();
    expect(viewerLink?.getAttribute("href")).toBe("/projects/proj-1");
  });

  it("carries a class IRI selection through to the destination", () => {
    mockPathname = "/projects/proj-1";
    mockSearch = "classIri=" + encodeURIComponent("http://example.org/Person");
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    expect(editorLink?.getAttribute("href")).toBe(
      "/projects/proj-1/editor?classIri=" + encodeURIComponent("http://example.org/Person"),
    );
  });

  it("carries a property IRI selection through to the destination", () => {
    mockPathname = "/projects/proj-1/editor";
    mockSearch = "propertyIri=" + encodeURIComponent("http://example.org/hasName");
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const viewerLink = screen.getByText("Viewer").closest("a");
    expect(viewerLink?.getAttribute("href")).toBe(
      "/projects/proj-1?propertyIri=" + encodeURIComponent("http://example.org/hasName"),
    );
  });

  it("carries an individual IRI selection through to the destination", () => {
    mockPathname = "/projects/proj-1";
    mockSearch = "individualIri=" + encodeURIComponent("http://example.org/alice");
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    expect(editorLink?.getAttribute("href")).toBe(
      "/projects/proj-1/editor?individualIri=" + encodeURIComponent("http://example.org/alice"),
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ViewerEditorSwitcher } from "@/components/editor/ViewerEditorSwitcher";
import { useSelectionStore } from "@/lib/stores/selectionStore";

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
    useSelectionStore.getState().clear();
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

  it("prefers the selection store over URL params when both are set", () => {
    mockPathname = "/projects/proj-1";
    // URL says one thing — typically a stale initial-load value
    mockSearch = "classIri=" + encodeURIComponent("http://example.org/Stale");
    // …but the user has since selected a property in this session
    useSelectionStore.getState().setSelection("http://example.org/hasName", "property");

    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    expect(editorLink?.getAttribute("href")).toBe(
      "/projects/proj-1/editor?propertyIri=" + encodeURIComponent("http://example.org/hasName"),
    );
  });

  it("falls back to URL params when the selection store is empty", () => {
    mockPathname = "/projects/proj-1";
    mockSearch = "individualIri=" + encodeURIComponent("http://example.org/alice");
    // store is cleared by beforeEach
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    expect(editorLink?.getAttribute("href")).toBe(
      "/projects/proj-1/editor?individualIri=" + encodeURIComponent("http://example.org/alice"),
    );
  });

  it("preserves unrelated query params (branch, resumeSession) in the destination href", () => {
    mockPathname = "/projects/proj-1";
    mockSearch =
      "branch=feature%2Ffoo" +
      "&resumeSession=abc123" +
      "&classIri=" + encodeURIComponent("http://example.org/Person");
    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    const href = editorLink?.getAttribute("href") ?? "";
    expect(href.startsWith("/projects/proj-1/editor?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    // unrelated params survive
    expect(params.get("branch")).toBe("feature/foo");
    expect(params.get("resumeSession")).toBe("abc123");
    // selection key is still carried correctly
    expect(params.get("classIri")).toBe("http://example.org/Person");
  });

  it("strips the previous selection key before writing a new one (mutual exclusion)", () => {
    mockPathname = "/projects/proj-1";
    // URL has a stale classIri…
    mockSearch = "classIri=" + encodeURIComponent("http://example.org/Stale");
    // …but the user has since selected a property in this session
    useSelectionStore.getState().setSelection("http://example.org/hasName", "property");

    render(<ViewerEditorSwitcher projectId="proj-1" />);

    const editorLink = screen.getByText("Editor").closest("a");
    const href = editorLink?.getAttribute("href") ?? "";
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    expect(params.get("classIri")).toBeNull();
    expect(params.get("propertyIri")).toBe("http://example.org/hasName");
  });
});

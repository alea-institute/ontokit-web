import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link to render a plain <a> tag
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ProjectCard } from "@/components/projects/project-card";
import type { Project } from "@/lib/api/projects";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-123",
    name: "Test Ontology",
    description: "A test project for ontology editing",
    is_public: true,
    owner_id: "user-1",
    created_at: "2024-06-01T12:00:00Z",
    updated_at: "2024-06-15T12:00:00Z",
    member_count: 3,
    ...overrides,
  };
}

describe("ProjectCard", () => {
  // ── Basic rendering ─────────────────────────────────────────────
  it("renders the project name", () => {
    render(<ProjectCard project={makeProject()} />);
    expect(screen.getByText("Test Ontology")).toBeDefined();
  });

  it("renders the project description", () => {
    render(<ProjectCard project={makeProject()} />);
    expect(screen.getByText("A test project for ontology editing")).toBeDefined();
  });

  it("does not render description when absent", () => {
    render(<ProjectCard project={makeProject({ description: undefined })} />);
    expect(screen.queryByText("A test project for ontology editing")).toBeNull();
  });

  // ── Link ────────────────────────────────────────────────────────
  it("links to the correct project URL", () => {
    render(<ProjectCard project={makeProject()} />);
    const link = screen.getByRole("link", { name: /Open project Test Ontology/ });
    expect(link.getAttribute("href")).toBe("/projects/proj-123");
  });

  // ── Public / Private indicator ──────────────────────────────────
  it("shows 'Public project' indicator for public projects", () => {
    render(<ProjectCard project={makeProject({ is_public: true })} />);
    expect(screen.getByTitle("Public project")).toBeDefined();
  });

  it("shows 'Private project' indicator for private projects", () => {
    render(<ProjectCard project={makeProject({ is_public: false })} />);
    expect(screen.getByTitle("Private project")).toBeDefined();
  });

  // ── Member count ────────────────────────────────────────────────
  it("shows member count with plural", () => {
    render(<ProjectCard project={makeProject({ member_count: 3 })} />);
    expect(screen.getByText("3 members")).toBeDefined();
  });

  it("shows singular 'member' for count of 1", () => {
    render(<ProjectCard project={makeProject({ member_count: 1 })} />);
    expect(screen.getByText("1 member")).toBeDefined();
  });

  // ── Role badge ──────────────────────────────────────────────────
  it("shows the user role badge when present", () => {
    render(<ProjectCard project={makeProject({ user_role: "owner" })} />);
    expect(screen.getByText("Owner")).toBeDefined();
  });

  it("shows editor role badge", () => {
    render(<ProjectCard project={makeProject({ user_role: "editor" })} />);
    expect(screen.getByText("Editor")).toBeDefined();
  });

  it("does not show role badge when user_role is absent", () => {
    render(<ProjectCard project={makeProject({ user_role: undefined })} />);
    expect(screen.queryByText("Owner")).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("Editor")).toBeNull();
    expect(screen.queryByText("Viewer")).toBeNull();
  });

  // ── Exemplar badge ──────────────────────────────────────────────
  it("shows Exemplar badge when is_exemplar is true", () => {
    render(<ProjectCard project={makeProject({ is_exemplar: true })} />);
    expect(screen.getByText("Exemplar")).toBeDefined();
  });

  it("does not show Exemplar badge when is_exemplar is false", () => {
    render(<ProjectCard project={makeProject({ is_exemplar: false })} />);
    expect(screen.queryByText("Exemplar")).toBeNull();
  });

  // ── Updated date ────────────────────────────────────────────────
  it("shows the updated_at date when present", () => {
    render(<ProjectCard project={makeProject({
      updated_at: "2025-03-20T12:00:00Z",
      created_at: "2024-01-10T12:00:00Z",
    })} />);
    const dateText = screen.getByText(/Updated/).textContent!;
    expect(dateText).toContain("2025");
    expect(dateText).not.toContain("2024");
  });

  it("falls back to created_at when updated_at is absent", () => {
    render(<ProjectCard project={makeProject({
      updated_at: undefined,
      created_at: "2023-11-05T12:00:00Z",
    })} />);
    const dateText = screen.getByText(/Updated/).textContent!;
    expect(dateText).toContain("2023");
  });

  // ── Custom className ────────────────────────────────────────────
  it("merges custom className onto the card", () => {
    render(<ProjectCard project={makeProject()} className="extra-class" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("extra-class");
  });
});

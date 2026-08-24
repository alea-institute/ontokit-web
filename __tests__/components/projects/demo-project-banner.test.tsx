import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectState } = vi.hoisted(() => ({
  projectState: {
    is_demo: false,
    name: "FOLIO Demo",
    demo_source_project_id: "folio-live" as string | undefined,
    demo_repository_full_name: "alea-institute/ontokit-demo-folio" as string | undefined,
  },
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "project-1" }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/hooks/useProject", () => ({
  useProject: () => ({ project: projectState }),
}));

import { DemoProjectBanner } from "@/components/projects/demo-project-banner";

describe("DemoProjectBanner", () => {
  beforeEach(() => {
    projectState.is_demo = false;
    projectState.demo_source_project_id = "folio-live";
    projectState.demo_repository_full_name = "alea-institute/ontokit-demo-folio";
  });

  it("renders only when the project response says it is a demo", () => {
    const { rerender } = render(<DemoProjectBanner />);
    expect(screen.queryByLabelText("Demo workspace notice")).toBeNull();

    projectState.is_demo = true;
    rerender(<DemoProjectBanner />);
    expect(screen.getByLabelText("Demo workspace notice")).toBeDefined();
    expect(screen.getByText(/alea-institute\/ontokit-demo-folio/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Return to source/ }).getAttribute("href"))
      .toBe("/projects/folio-live");
  });

  it("falls back to honest project metadata when optional demo links are absent", () => {
    projectState.is_demo = true;
    projectState.demo_source_project_id = undefined;
    projectState.demo_repository_full_name = undefined;

    render(<DemoProjectBanner />);

    expect(screen.getByText(/Demo workspace: FOLIO Demo/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Return to source/ }).getAttribute("href"))
      .toBe("/");
  });
});

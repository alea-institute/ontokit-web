import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/projects/demo-project-banner", () => ({
  DemoProjectShell: ({ children }: { children: React.ReactNode }) => (
    <div>
      <aside>Demo banner marker</aside>
      <div data-testid="project-route-scroll-region">{children}</div>
    </div>
  ),
}));

import ProjectLayout from "@/app/projects/[id]/layout";

describe("ProjectLayout", () => {
  it("routes project content through the persistent demo shell", () => {
    render(
      <ProjectLayout><main>Project route marker</main></ProjectLayout>,
    );

    expect(screen.getByText("Project route marker")).toBeDefined();
    expect(screen.getByText("Demo banner marker")).toBeDefined();
    const routeScroller = screen.getByTestId("project-route-scroll-region");
    expect(routeScroller.textContent).toContain("Project route marker");
  });
});

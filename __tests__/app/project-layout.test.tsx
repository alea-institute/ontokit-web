import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/projects/demo-project-banner", () => ({
  DemoProjectBanner: () => <aside>Demo banner marker</aside>,
}));

import ProjectLayout from "@/app/projects/[id]/layout";

describe("ProjectLayout", () => {
  it("mounts route content and the persistent demo banner", () => {
    render(<ProjectLayout><main>Project route marker</main></ProjectLayout>);

    expect(screen.getByText("Project route marker")).toBeDefined();
    expect(screen.getByText("Demo banner marker")).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LLMRoleBadge } from "@/components/editor/LLMRoleBadge";

describe("LLMRoleBadge", () => {
  it("renders nothing when roleLimitLabel is null (viewer/anonymous)", () => {
    const { container } = render(
      <LLMRoleBadge roleLimitLabel={null} userRole="viewer" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the role limit label with an accessible sr-only description", () => {
    render(
      <LLMRoleBadge
        roleLimitLabel={"Editor — 500/day"}
        userRole="editor"
      />
    );
    expect(screen.getByText("Editor — 500/day")).toBeTruthy();
    const srPrefix = screen.getByText("Your LLM access:");
    expect(srPrefix.className).toContain("sr-only");
  });

  it("uses distinct color treatments per role", () => {
    const { rerender } = render(
      <LLMRoleBadge
        roleLimitLabel={"Admin — unlimited"}
        userRole="admin"
      />
    );
    expect(screen.getByText("Admin — unlimited").className).toContain(
      "violet"
    );

    rerender(
      <LLMRoleBadge
        roleLimitLabel={"Suggester — 100/day"}
        userRole="suggester"
      />
    );
    expect(screen.getByText("Suggester — 100/day").className).toContain(
      "green"
    );
  });
});

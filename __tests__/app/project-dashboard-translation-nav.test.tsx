import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "token" }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "project-1" }) }));
vi.mock("@/components/layout/header", () => ({ Header: () => <header /> }));
vi.mock("@/lib/api/joinRequests", () => ({
  joinRequestApi: { list: vi.fn(), getMine: vi.fn(), create: vi.fn(), withdraw: vi.fn() },
}));
vi.mock("@/lib/hooks/useProject", () => ({
  useProject: () => ({
    project: {
      id: "project-1",
      name: "Ontology",
      is_public: false,
      owner_id: "owner",
      created_at: "2026-01-01T00:00:00Z",
      member_count: 1,
      user_role: "viewer",
      source_file_path: "ontology.ttl",
    },
    isLoading: false,
    error: null,
  }),
  derivePermissions: () => ({ canEdit: false, canSuggest: false, canManage: false }),
}));

import ProjectDashboardPage from "@/app/projects/[id]/dashboard/page";

describe("project dashboard translation navigation", () => {
  it("routes a project member to Translation Coverage", () => {
    render(<ProjectDashboardPage />);
    const link = screen.getByRole("link", { name: /translation coverage/i });
    expect(link.getAttribute("href")).toBe("/projects/project-1/translations");
  });
});

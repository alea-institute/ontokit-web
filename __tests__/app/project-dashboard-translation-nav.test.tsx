import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMyReviewerLanguages } = vi.hoisted(() => ({ getMyReviewerLanguages: vi.fn() }));
const dashboardState = vi.hoisted(() => ({ role: "viewer" }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "token" }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "project-1" }) }));
vi.mock("@/components/layout/header", () => ({ Header: () => <header /> }));
vi.mock("@/lib/api/joinRequests", () => ({
  joinRequestApi: { list: vi.fn(), getMine: vi.fn(), create: vi.fn(), withdraw: vi.fn() },
}));
vi.mock("@/lib/api/translations", () => ({
  translationsApi: { getMyReviewerLanguages },
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
      user_role: dashboardState.role,
      source_file_path: "ontology.ttl",
    },
    isLoading: false,
    error: null,
  }),
  derivePermissions: () => ({
    canEdit: false,
    canSuggest: false,
    canManage: dashboardState.role === "admin",
  }),
}));

import ProjectDashboardPage from "@/app/projects/[id]/dashboard/page";

describe("project dashboard translation navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardState.role = "viewer";
    getMyReviewerLanguages.mockResolvedValue({ languages: [] });
  });

  it("routes a project member to Translation Coverage", () => {
    render(<ProjectDashboardPage />);
    const link = screen.getByRole("link", { name: /translation coverage/i });
    expect(link.getAttribute("href")).toBe("/projects/project-1/translations");
  });

  it("shows Translation Review to tagged reviewers", async () => {
    getMyReviewerLanguages.mockResolvedValue({ languages: ["sw"] });
    render(<ProjectDashboardPage />);
    const link = await screen.findByRole("link", { name: /translation review/i });
    expect(link.getAttribute("href")).toBe("/projects/project-1/translations/review");
  });

  it("shows Translation Review to admins and hides it from untagged non-admins", async () => {
    const { unmount } = render(<ProjectDashboardPage />);
    await vi.waitFor(() => expect(getMyReviewerLanguages).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /translation review/i })).toBeNull();
    unmount();

    dashboardState.role = "admin";
    render(<ProjectDashboardPage />);
    expect(await screen.findByRole("link", { name: /translation review/i })).toBeDefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitHubRepoPicker } from "@/components/projects/github-repo-picker";
import type { GitHubRepoInfo } from "@/lib/api/userSettings";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>
      {children as React.ReactNode}
    </a>
  ),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { accessToken: "test-token", user: { name: "Test" } },
    status: "authenticated",
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Check: (props: Record<string, unknown>) => <span data-testid="check-icon" {...props} />,
  Search: (props: Record<string, unknown>) => <span data-testid="search-icon" {...props} />,
}));

// Mock userSettingsApi
const mockGetGitHubTokenStatus = vi.fn();
const mockListGitHubRepos = vi.fn();

vi.mock("@/lib/api/userSettings", () => ({
  userSettingsApi: {
    getGitHubTokenStatus: (...args: unknown[]) => mockGetGitHubTokenStatus(...args),
    listGitHubRepos: (...args: unknown[]) => mockListGitHubRepos(...args),
  },
}));

const sampleRepo: GitHubRepoInfo = {
  full_name: "user/ontology-repo",
  owner: "user",
  name: "ontology-repo",
  description: "An ontology repository",
  private: false,
  default_branch: "main",
  html_url: "https://github.com/user/ontology-repo",
};

const privateRepo: GitHubRepoInfo = {
  full_name: "user/private-repo",
  owner: "user",
  name: "private-repo",
  private: true,
  default_branch: "develop",
  html_url: "https://github.com/user/private-repo",
};

beforeEach(() => {
  mockGetGitHubTokenStatus.mockReset();
  mockListGitHubRepos.mockReset();
});

describe("GitHubRepoPicker", () => {
  it("shows loading spinner while checking token status", () => {
    mockGetGitHubTokenStatus.mockReturnValue(new Promise(() => {}));
    const { container } = render(<GitHubRepoPicker onSelect={vi.fn()} />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows connect message when no token", async () => {
    mockGetGitHubTokenStatus.mockResolvedValue({ has_token: false });
    render(<GitHubRepoPicker onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Connect your GitHub account first/),
      ).toBeDefined();
    });
    const link = screen.getByText("Go to Settings");
    expect(link.closest("a")?.getAttribute("href")).toBe("/settings");
  });

  it("loads and displays repos when token exists", async () => {
    mockGetGitHubTokenStatus.mockResolvedValue({ has_token: true });
    mockListGitHubRepos.mockResolvedValue({
      items: [sampleRepo, privateRepo],
      total: 2,
    });
    render(<GitHubRepoPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("user/ontology-repo")).toBeDefined();
    });
    expect(screen.getByText("user/private-repo")).toBeDefined();
    expect(screen.getByText("Private")).toBeDefined();
    expect(screen.getByText("An ontology repository")).toBeDefined();
    expect(screen.getByText("Default branch: main")).toBeDefined();
  });

  it("calls onSelect when a repo is clicked", async () => {
    const onSelect = vi.fn();
    mockGetGitHubTokenStatus.mockResolvedValue({ has_token: true });
    mockListGitHubRepos.mockResolvedValue({
      items: [sampleRepo],
      total: 1,
    });
    const user = userEvent.setup();
    render(<GitHubRepoPicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("user/ontology-repo")).toBeDefined();
    });
    await user.click(screen.getByText("user/ontology-repo"));
    expect(onSelect).toHaveBeenCalledWith(sampleRepo);
  });

  it("shows empty message when no repos found", async () => {
    mockGetGitHubTokenStatus.mockResolvedValue({ has_token: true });
    mockListGitHubRepos.mockResolvedValue({ items: [], total: 0 });
    render(<GitHubRepoPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("No repositories available"),
      ).toBeDefined();
    });
  });

  it("searches repos on input change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockGetGitHubTokenStatus.mockResolvedValue({ has_token: true });
    mockListGitHubRepos
      .mockResolvedValueOnce({ items: [sampleRepo], total: 1 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    render(<GitHubRepoPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search by name...")).toBeDefined();
    });

    await user.type(
      screen.getByPlaceholderText("Search by name..."),
      "missing",
    );

    // Debounce fires after 300ms
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockListGitHubRepos).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});

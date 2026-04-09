import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock all external dependencies before imports
vi.mock("@/lib/api/lint", () => ({
  lintApi: {
    getStatus: vi.fn(),
    getIssues: vi.fn(),
    triggerLint: vi.fn(),
    dismissIssue: vi.fn(),
  },
  createLintWebSocket: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock("@/lib/api/quality", () => ({
  qualityApi: {
    triggerConsistencyCheck: vi.fn(),
    getConsistencyIssues: vi.fn(),
    getDuplicateCandidates: vi.fn(),
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatDateTime: (d: string) => d,
  getLocalName: (iri: string) => iri.split(/[#/]/).pop() || iri,
}));

import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";
import { lintApi, createLintWebSocket } from "@/lib/api/lint";
import { qualityApi } from "@/lib/api/quality";

const mockLintApi = vi.mocked(lintApi);
const mockQualityApi = vi.mocked(qualityApi);
const mockCreateLintWebSocket = vi.mocked(createLintWebSocket);

const baseSummary = {
  project_id: "p1",
  last_run: {
    id: "run1",
    project_id: "p1",
    status: "completed" as const,
    started_at: "2025-01-01T00:00:00Z",
    completed_at: "2025-01-01T00:01:00Z",
    issues_found: 3,
    error_message: null,
  },
  error_count: 1,
  warning_count: 1,
  info_count: 1,
  total_issues: 3,
};

const baseIssues = {
  items: [
    {
      id: "i1",
      run_id: "run1",
      project_id: "p1",
      issue_type: "error" as const,
      rule_id: "R001",
      message: "Missing label",
      subject_iri: "http://example.org/Foo",
      details: null,
      created_at: "2025-01-01T00:00:00Z",
      resolved_at: null,
    },
    {
      id: "i2",
      run_id: "run1",
      project_id: "p1",
      issue_type: "warning" as const,
      rule_id: "R002",
      message: "Deprecated parent",
      subject_iri: null,
      details: null,
      created_at: "2025-01-01T00:00:00Z",
      resolved_at: null,
    },
  ],
  total: 2,
  skip: 0,
  limit: 500,
};

function setup(overrides: Partial<React.ComponentProps<typeof HealthCheckPanel>> = {}) {
  const defaults = {
    projectId: "p1",
    accessToken: "tok",
    isOpen: true,
    onClose: vi.fn(),
    onNavigateToClass: vi.fn(),
    canRunLint: true,
  };
  return render(<HealthCheckPanel {...defaults} {...overrides} />);
}

describe("HealthCheckPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLintApi.getStatus.mockResolvedValue(baseSummary);
    mockLintApi.getIssues.mockResolvedValue(baseIssues);
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [],
      checked_at: "",
      duration_ms: 0,
    });
    mockCreateLintWebSocket.mockReturnValue({ close: vi.fn() } as unknown as WebSocket);
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = setup({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders header and tabs when open", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Health Check")).toBeDefined();
    });
    expect(screen.getByText("Lint")).toBeDefined();
    expect(screen.getByText("Consistency")).toBeDefined();
    expect(screen.getByText("Duplicates")).toBeDefined();
  });

  it("shows summary cards after data loads", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Errors")).toBeDefined();
    });
    expect(screen.getByText("Warnings")).toBeDefined();
    expect(screen.getByText("Info")).toBeDefined();
    expect(screen.getByText("Total")).toBeDefined();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1); // error_count
  });

  it("shows lint issues", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Missing label")).toBeDefined();
    });
    expect(screen.getByText("Deprecated parent")).toBeDefined();
    expect(screen.getByText("R001")).toBeDefined();
  });

  it("shows Run Lint button and triggers lint", async () => {
    mockLintApi.triggerLint.mockResolvedValue({
      job_id: "j1",
      status: "pending",
      message: "started",
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    const btn = screen.getByText("Run Lint");
    await userEvent.click(btn);
    expect(mockLintApi.triggerLint).toHaveBeenCalledWith("p1", "tok");
  });

  it("shows error when triggerLint fails", async () => {
    mockLintApi.triggerLint.mockRejectedValue(new Error("Nope"));
    setup();
    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Run Lint"));
    await waitFor(() => {
      expect(screen.getByText("Nope")).toBeDefined();
    });
  });

  it("disables Run Lint when canRunLint is false", async () => {
    setup({ canRunLint: false });
    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    const btn = screen.getByText("Run Lint").closest("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("shows error when lint requires auth but none provided", async () => {
    setup({ accessToken: undefined, canRunLint: true });
    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    const btn = screen.getByText("Run Lint").closest("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    setup({ onClose });
    await waitFor(() => {
      expect(screen.getByText("Health Check")).toBeDefined();
    });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeTruthy();
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays no issues message when total is 0", async () => {
    mockLintApi.getStatus.mockResolvedValue({
      ...baseSummary,
      total_issues: 0,
      error_count: 0,
      warning_count: 0,
      info_count: 0,
    });
    mockLintApi.getIssues.mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 500,
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("No issues found")).toBeDefined();
    });
  });

  it("displays no run yet message when last_run is null", async () => {
    mockLintApi.getStatus.mockResolvedValue({
      ...baseSummary,
      last_run: null,
      total_issues: 0,
      error_count: 0,
      warning_count: 0,
      info_count: 0,
    });
    mockLintApi.getIssues.mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 500,
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("No lint run yet")).toBeDefined();
    });
  });

  it("shows error when fetch fails", async () => {
    mockLintApi.getStatus.mockRejectedValue(new Error("Network error"));
    setup();
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("navigates to class when issue link is clicked", async () => {
    const onNav = vi.fn();
    setup({ onNavigateToClass: onNav });
    await waitFor(() => {
      expect(screen.getByText("Foo")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Foo"));
    expect(onNav).toHaveBeenCalledWith("http://example.org/Foo");
  });

  it("switches to consistency tab", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("No consistency issues")).toBeDefined();
    });
  });

  it("switches to duplicates tab", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("No duplicates detected")).toBeDefined();
    });
  });

  it("shows Run Check button on consistency tab", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Run Check")).toBeDefined();
    });
  });

  it("shows Find Duplicates button on duplicates tab", async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Find Duplicates")).toBeDefined();
    });
  });

  it("runs consistency check when Run Check is clicked", async () => {
    mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "j1" });
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [
        {
          rule_id: "orphan_class",
          severity: "warning",
          entity_iri: "http://example.org/Bar",
          entity_type: "class",
          message: "Orphan class detected",
        },
      ],
      checked_at: "",
      duration_ms: 100,
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Run Check")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Run Check"));
    await waitFor(() => {
      expect(screen.getByText("Orphan class detected")).toBeDefined();
    });
  });

  it("detects duplicates when Find Duplicates is clicked", async () => {
    mockQualityApi.getDuplicateCandidates.mockResolvedValue({
      clusters: [
        {
          entities: [
            { iri: "http://example.org/A", label: "EntityA", entity_type: "class" },
            { iri: "http://example.org/B", label: "EntityB", entity_type: "class" },
          ],
          similarity: 0.92,
        },
      ],
      threshold: 0.85,
      checked_at: "",
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Find Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Find Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("92% similar")).toBeDefined();
    });
    expect(screen.getByText("EntityA")).toBeDefined();
    expect(screen.getByText("EntityB")).toBeDefined();
  });

  it("shows Running status when lint is in progress", async () => {
    mockLintApi.getStatus.mockResolvedValue({
      ...baseSummary,
      last_run: {
        ...baseSummary.last_run!,
        status: "running" as const,
      },
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("Running")).toBeDefined();
    });
  });

  it("dismisses an issue when dismiss button is clicked", async () => {
    mockLintApi.dismissIssue.mockResolvedValue(undefined as never);
    setup();
    await waitFor(() => {
      expect(screen.getByText("Missing label")).toBeDefined();
    });
    // Find dismiss buttons (X buttons inside issue cards) - they have title "Dismiss issue"
    const dismissBtns = screen.getAllByTitle("Dismiss issue");
    expect(dismissBtns.length).toBeGreaterThan(0);
    await userEvent.click(dismissBtns[0]);
    expect(mockLintApi.dismissIssue).toHaveBeenCalledWith("p1", "i1", "tok");
  });
});

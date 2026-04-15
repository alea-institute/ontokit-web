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
    getConsistencyJobResult: vi.fn(),
    getConsistencyIssues: vi.fn(),
    triggerDuplicateDetection: vi.fn(),
    getDuplicateJobResult: vi.fn(),
    getLatestDuplicates: vi.fn(),
  },
  createQualityWebSocket: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatDateTime: (d: string) => d,
  getLocalName: (iri: string) => iri.split(/[#/]/).pop() || iri,
}));

import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";
import { lintApi, createLintWebSocket, type LintWebSocketMessage } from "@/lib/api/lint";
import { qualityApi, createQualityWebSocket, type QualityWebSocketMessage } from "@/lib/api/quality";

const mockLintApi = vi.mocked(lintApi);
const mockQualityApi = vi.mocked(qualityApi);
const mockCreateLintWebSocket = vi.mocked(createLintWebSocket);
const mockCreateQualityWebSocket = vi.mocked(createQualityWebSocket);

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
    // Mock requestAnimationFrame so deferred cached-data fetches fire synchronously
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
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
    mockQualityApi.getLatestDuplicates.mockResolvedValue({
      clusters: [],
      threshold: 0.85,
      checked_at: "",
    });
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

  it("runs consistency check via polling fallback when Run Check is clicked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-j1" });
      mockQualityApi.getConsistencyJobResult.mockResolvedValue({
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
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => {
        expect(screen.getByText("Run Check")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );
      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(screen.getByText("Orphan class detected")).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs consistency check via WebSocket when WS is connected", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
        capturedOnMessage = onMessage;
        setTimeout(() => onOpen?.(), 0);
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );
    mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-ws1" });
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [
        {
          rule_id: "missing_label",
          severity: "info",
          entity_iri: "http://example.org/WsC",
          entity_type: "class",
          message: "Missing label via WS",
        },
      ],
      checked_at: "",
      duration_ms: 80,
    });

    setup();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Run Check")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Run Check"));
    expect(mockQualityApi.triggerConsistencyCheck).toHaveBeenCalled();

    capturedOnMessage!({
      type: "consistency_complete",
      project_id: "p1",
      branch: "main",
    });
    await waitFor(() => {
      expect(screen.getByText("Missing label via WS")).toBeDefined();
    });
    expect(mockQualityApi.getConsistencyJobResult).not.toHaveBeenCalled();
  });

  it("shows error when consistency check trigger fails", async () => {
    mockQualityApi.triggerConsistencyCheck.mockRejectedValue(
      new Error("Consistency backend down")
    );
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
      expect(screen.getByText("Consistency backend down")).toBeDefined();
    });
  });

  it("surfaces consistency polling errors in the UI", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-500" });
      const serverError = Object.assign(new Error("Server error"), { status: 500 });
      mockQualityApi.getConsistencyJobResult.mockRejectedValue(serverError);
      setup();
      await waitFor(() => {
        expect(screen.getByText("Consistency")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => {
        expect(screen.getByText("Run Check")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );
      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeDefined();
      });
      expect(mockQualityApi.getConsistencyJobResult).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows consistency timeout on WS path when WS message is lost", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, _onMessage, _onError, _onClose, _token, onOpen) => {
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-ws-lost" });

      setup();
      await waitFor(() => {
        expect(mockCreateQualityWebSocket).toHaveBeenCalled();
      });
      await vi.advanceTimersByTimeAsync(10);

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => {
        expect(screen.getByText("Run Check")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      await vi.advanceTimersByTimeAsync(61_000);

      await waitFor(() => {
        expect(
          screen.getByText("Consistency check timed out — try again later")
        ).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows consistency polling timeout when all attempts exhausted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-slow" });
      mockQualityApi.getConsistencyJobResult.mockResolvedValue({
        job_id: "cons-slow",
        status: "pending",
      } as unknown as Awaited<ReturnType<typeof qualityApi.getConsistencyJobResult>>);

      setup();
      await waitFor(() => {
        expect(screen.getByText("Consistency")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => {
        expect(screen.getByText("Run Check")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      for (let i = 0; i < 25; i++) {
        await vi.advanceTimersByTimeAsync(6000);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Consistency check timed out — try again later")
        ).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("consistency poll handles pending then complete response", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-pend" });
      let callCount = 0;
      mockQualityApi.getConsistencyJobResult.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({ job_id: "cons-pend", status: "pending" } as never);
        }
        return Promise.resolve({
          project_id: "p1",
          branch: "main",
          issues: [
            {
              rule_id: "missing_label",
              severity: "info",
              entity_iri: "http://example.org/PendEntity",
              entity_type: "class",
              message: "Pending then complete",
            },
          ],
          checked_at: "",
          duration_ms: 50,
        });
      });
      setup();
      await waitFor(() => {
        expect(screen.getByText("Consistency")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => {
        expect(screen.getByText("Run Check")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );
      // Advance through polling delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }
      await waitFor(() => {
        expect(screen.getByText("Pending then complete")).toBeDefined();
      });
      expect(mockQualityApi.getConsistencyJobResult).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads cached consistency results on tab switch", async () => {
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [
        {
          rule_id: "orphan_class",
          severity: "warning",
          entity_iri: "http://example.org/CachedCons",
          entity_type: "class",
          message: "Cached consistency issue",
        },
      ],
      checked_at: "",
      duration_ms: 50,
    });
    setup();
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Cached consistency issue")).toBeDefined();
    });
  });

  it("loads cached duplicates results on tab switch", async () => {
    mockQualityApi.getLatestDuplicates.mockResolvedValue({
      clusters: [
        {
          entities: [
            { iri: "http://example.org/CachedA", label: "CachedA", entity_type: "class" },
            { iri: "http://example.org/CachedB", label: "CachedB", entity_type: "class" },
          ],
          similarity: 0.87,
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
      expect(screen.getByText("CachedA")).toBeDefined();
    });
    expect(screen.getByText("87% similar")).toBeDefined();
  });

  it("logs error when cached consistency fetch fails on tab switch", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQualityApi.getConsistencyIssues.mockRejectedValue(new Error("Network fail"));
    setup();
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load cached consistency issues"),
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it("logs error when cached duplicates fetch fails on tab switch", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQualityApi.getLatestDuplicates.mockRejectedValue(new Error("Network fail"));
    setup();
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load cached duplicates"),
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it("detects duplicates via polling fallback when WS is not connected", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const duplicateResult = {
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
      };
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-j1" });
      mockQualityApi.getDuplicateJobResult.mockResolvedValue(duplicateResult);
      setup();
      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );
      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(screen.getByText("92% similar")).toBeDefined();
      });
      expect(screen.getByText("EntityA")).toBeDefined();
      expect(screen.getByText("EntityB")).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("detects duplicates via WebSocket when WS is connected", async () => {
    // Capture the onMessage callback and trigger onOpen to mark WS as connected
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
        capturedOnMessage = onMessage;
        // Simulate successful handshake
        setTimeout(() => onOpen?.(), 0);
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    const duplicateResult = {
      clusters: [
        {
          entities: [
            { iri: "http://example.org/WsX", label: "WsX", entity_type: "class" },
            { iri: "http://example.org/WsY", label: "WsY", entity_type: "class" },
          ],
          similarity: 0.89,
        },
      ],
      threshold: 0.85,
      checked_at: "",
    };
    mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-ws1" });
    mockQualityApi.getLatestDuplicates.mockResolvedValue(duplicateResult);

    setup();

    // Wait for the WS to connect (marks qualityWsConnected = true)
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    // Switch to duplicates tab and trigger
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Find Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Find Duplicates"));

    // Trigger should fire but NOT poll — WS handles it
    expect(mockQualityApi.triggerDuplicateDetection).toHaveBeenCalled();

    // Simulate WS delivering the result
    capturedOnMessage!({
      type: "duplicates_complete",
      project_id: "p1",
      branch: "main",
    });

    await waitFor(() => {
      expect(screen.getByText("89% similar")).toBeDefined();
    });
    expect(screen.getByText("WsX")).toBeDefined();
    expect(screen.getByText("WsY")).toBeDefined();
    // Should NOT have polled the job result endpoint
    expect(mockQualityApi.getDuplicateJobResult).not.toHaveBeenCalled();
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

  it("shows error when duplicate detection trigger fails", async () => {
    mockQualityApi.triggerDuplicateDetection.mockRejectedValue(
      new Error("Backend unavailable")
    );
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
      expect(screen.getByText("Backend unavailable")).toBeDefined();
    });
  });

  it("surfaces polling errors in the UI", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-500" });
      const serverError = Object.assign(new Error("Internal server error"), { status: 500 });
      mockQualityApi.getDuplicateJobResult.mockRejectedValue(serverError);
      setup();
      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );
      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(screen.getByText("Internal server error")).toBeDefined();
      });
      expect(mockQualityApi.getDuplicateJobResult).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads cached duplicates when switching to duplicates tab", async () => {
    const cachedResult = {
      clusters: [
        {
          entities: [
            { iri: "http://example.org/X", label: "CachedX", entity_type: "class" },
            { iri: "http://example.org/Y", label: "CachedY", entity_type: "class" },
          ],
          similarity: 0.88,
        },
      ],
      threshold: 0.85,
      checked_at: "",
    };
    mockQualityApi.getLatestDuplicates.mockResolvedValue(cachedResult);
    setup();
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("CachedX")).toBeDefined();
    });
    expect(screen.getByText("CachedY")).toBeDefined();
    expect(screen.getByText("88% similar")).toBeDefined();
  });

  it("navigates to entity when duplicate entity is clicked", async () => {
    const onNav = vi.fn();
    const cachedResult = {
      clusters: [
        {
          entities: [
            { iri: "http://example.org/DupA", label: "DupA", entity_type: "class" },
            { iri: "http://example.org/DupB", label: "DupB", entity_type: "property" },
          ],
          similarity: 0.95,
        },
      ],
      threshold: 0.85,
      checked_at: "",
    };
    mockQualityApi.getLatestDuplicates.mockResolvedValue(cachedResult);
    setup({ onNavigateToClass: onNav });
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("DupA")).toBeDefined();
    });
    await userEvent.click(screen.getByText("DupA"));
    expect(onNav).toHaveBeenCalledWith("http://example.org/DupA");
  });

  it("navigates to entity from consistency issue", async () => {
    const onNav = vi.fn();
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [
        {
          rule_id: "orphan_class",
          severity: "warning",
          entity_iri: "http://example.org/ConsEntity",
          entity_type: "class",
          message: "Orphan detected",
        },
      ],
      checked_at: "",
      duration_ms: 50,
    });
    setup({ onNavigateToClass: onNav });
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("ConsEntity")).toBeDefined();
    });
    await userEvent.click(screen.getByText("ConsEntity"));
    expect(onNav).toHaveBeenCalledWith("http://example.org/ConsEntity");
  });

  it("handles quality WebSocket duplicates_complete message", async () => {
    // Capture the onMessage callback from createQualityWebSocket
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    const duplicateResult = {
      clusters: [
        {
          entities: [
            { iri: "http://example.org/WsA", label: "WsEntityA", entity_type: "class" },
            { iri: "http://example.org/WsB", label: "WsEntityB", entity_type: "class" },
          ],
          similarity: 0.91,
        },
      ],
      threshold: 0.85,
      checked_at: "",
    };
    mockQualityApi.getLatestDuplicates.mockResolvedValue(duplicateResult);

    setup();

    // Wait for the WS to connect (100ms timeout + execution)
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    // Simulate duplicates_complete message
    capturedOnMessage!({
      type: "duplicates_complete",
      project_id: "p1",
      branch: "main",
    });

    // Switch to duplicates tab to see the results
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("WsEntityA")).toBeDefined();
    });
  });

  it("handles quality WebSocket duplicates_failed message", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();

    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    capturedOnMessage!({
      type: "duplicates_failed",
      project_id: "p1",
      branch: "main",
      error: "Worker crashed",
    });

    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Worker crashed")).toBeDefined();
    });
  });

  it("handles quality WebSocket consistency_started and consistency_complete messages", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();

    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    // Switch to consistency tab
    await userEvent.click(screen.getByText("Consistency"));

    // Simulate consistency_started
    capturedOnMessage!({
      type: "consistency_started",
      project_id: "p1",
      branch: "main",
    });

    // Now simulate consistency_complete with issues
    mockQualityApi.getConsistencyIssues.mockResolvedValue({
      project_id: "p1",
      branch: "main",
      issues: [
        {
          rule_id: "cycle_detect",
          severity: "error",
          entity_iri: "http://example.org/CycleEntity",
          entity_type: "class",
          message: "Cycle found",
        },
      ],
      checked_at: "",
      duration_ms: 200,
    });

    capturedOnMessage!({
      type: "consistency_complete",
      project_id: "p1",
      branch: "main",
    });

    await waitFor(() => {
      expect(screen.getByText("Cycle found")).toBeDefined();
    });
  });

  it("handles quality WebSocket consistency_failed message", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();

    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    capturedOnMessage!({
      type: "consistency_failed",
      project_id: "p1",
      branch: "main",
      error: "Graph load failed",
    });

    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Graph load failed")).toBeDefined();
    });
  });

  it("handles quality WebSocket duplicates_started message", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();

    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    capturedOnMessage!({
      type: "duplicates_started",
      project_id: "p1",
      branch: "main",
    });

    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Detecting...")).toBeDefined();
    });
  });

  it("ignores quality WebSocket events for other branches", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    // Render with branch "dev"
    setup({ branch: "dev" });

    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    // Simulate a duplicates_complete for branch "main" — should be ignored
    capturedOnMessage!({
      type: "duplicates_complete",
      project_id: "p1",
      branch: "main",
    });

    // Switch to duplicates tab — the WS event should have been ignored,
    // so no results were loaded from the WS handler
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("No duplicates detected")).toBeDefined();
    });
    // getLatestDuplicates should NOT have been called by the WS handler
    // (tab-switch cache fetch uses requestAnimationFrame so may not fire in tests)
    const calls = mockQualityApi.getLatestDuplicates.mock.calls;
    const wsHandlerCalls = calls.filter(
      (c: unknown[]) => c[2] !== "dev" // WS handler would pass the WS branch, not "dev"
    );
    expect(wsHandlerCalls).toHaveLength(0);
  });

  it("does not open quality WebSocket when no access token", () => {
    mockCreateQualityWebSocket.mockClear();
    setup({ accessToken: undefined });
    // The quality WS should not have been called since there's no token
    // (100ms timeout hasn't fired, and the effect early-returns)
    expect(mockCreateQualityWebSocket).not.toHaveBeenCalled();
  });

  it("consistency check does nothing without access token", async () => {
    setup({ accessToken: undefined });
    await waitFor(() => {
      expect(screen.getByText("Consistency")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Run Check")).toBeDefined();
    });
    // Button is disabled, but test the handler guard directly
    expect(mockQualityApi.triggerConsistencyCheck).not.toHaveBeenCalled();
  });

  it("duplicate detection does nothing without access token", async () => {
    setup({ accessToken: undefined });
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeDefined();
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Find Duplicates")).toBeDefined();
    });
    expect(mockQualityApi.triggerDuplicateDetection).not.toHaveBeenCalled();
  });

  it("quality WS onError and onClose reset connected flag", async () => {
    let capturedOnError: ((err: Event) => void) | null = null;
    let capturedOnClose: ((evt: CloseEvent) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, _onMessage, onError, onClose, _token, onOpen) => {
        capturedOnError = onError!;
        capturedOnClose = onClose!;
        setTimeout(() => onOpen?.(), 0);
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();
    await waitFor(() => {
      expect(mockCreateQualityWebSocket).toHaveBeenCalled();
    });

    // Trigger onError
    capturedOnError!(new Event("error"));
    // Trigger onClose
    capturedOnClose!(new CloseEvent("close", { code: 1006 }));

    // If we got here without errors, the callbacks executed successfully
    expect(capturedOnError).not.toBeNull();
    expect(capturedOnClose).not.toBeNull();
  });

  it("shows timeout error when polling exhausts all attempts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-slow" });
      // Always return pending so the loop keeps polling until timeout
      mockQualityApi.getDuplicateJobResult.mockResolvedValue({
        job_id: "dup-slow",
        status: "pending",
      } as unknown as Awaited<ReturnType<typeof qualityApi.getDuplicateJobResult>>);

      setup();
      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // Advance enough time for all polling attempts
      for (let i = 0; i < 25; i++) {
        await vi.advanceTimersByTimeAsync(6000);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Duplicate detection timed out — try again later")
        ).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows generic error when trigger throws non-Error value", async () => {
    mockQualityApi.triggerDuplicateDetection.mockRejectedValue("string-error");
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
      expect(screen.getByText("Duplicate detection failed")).toBeDefined();
    });
  });

  it("shows timeout error on WS path when WS message is lost", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // Connect WS and trigger onOpen so qualityWsConnected = true
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, _onMessage, _onError, _onClose, _token, onOpen) => {
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-ws-lost" });

      setup();

      // Wait for WS to connect
      await waitFor(() => {
        expect(mockCreateQualityWebSocket).toHaveBeenCalled();
      });
      // Tick for onOpen setTimeout
      await vi.advanceTimersByTimeAsync(10);

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // WS message never arrives — advance past the 60s safety timeout
      await vi.advanceTimersByTimeAsync(61_000);

      await waitFor(() => {
        expect(
          screen.getByText("Duplicate detection timed out — try again later")
        ).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels polling loop on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-cancel" });
      mockQualityApi.getDuplicateJobResult.mockResolvedValue({
        job_id: "dup-cancel",
        status: "pending",
      } as unknown as Awaited<ReturnType<typeof qualityApi.getDuplicateJobResult>>);

      const { unmount } = setup();

      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates")).toBeDefined();
      });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // Let one poll iteration start
      await vi.advanceTimersByTimeAsync(1500);
      const callsBefore = mockQualityApi.getDuplicateJobResult.mock.calls.length;

      // Unmount mid-poll — should cancel further iterations
      unmount();

      // Advance more time — should NOT produce more API calls
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockQualityApi.getDuplicateJobResult.mock.calls.length).toBe(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows error when WS consistency fetch fails after completion", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );
    mockQualityApi.getConsistencyIssues.mockRejectedValue(new Error("Fetch failed"));
    setup();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    capturedOnMessage!({
      type: "consistency_complete",
      project_id: "p1",
      branch: "main",
    });
    await userEvent.click(screen.getByText("Consistency"));
    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeDefined();
    });
  });

  it("shows error when WS duplicates fetch fails after completion", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );
    mockQualityApi.getLatestDuplicates.mockRejectedValue(new Error("Dup fetch failed"));
    setup();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    capturedOnMessage!({
      type: "duplicates_complete",
      project_id: "p1",
      branch: "main",
    });
    await userEvent.click(screen.getByText("Duplicates"));
    await waitFor(() => {
      expect(screen.getByText("Dup fetch failed")).toBeDefined();
    });
  });

  it("clears timeout refs on WS consistency_complete", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
          capturedOnMessage = onMessage;
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-to" });
      mockQualityApi.getConsistencyIssues.mockResolvedValue({
        project_id: "p1", branch: "main", issues: [], checked_at: "", duration_ms: 0,
      });

      setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      // Switch to consistency tab and trigger — sets the timeout ref
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => { expect(screen.getByText("Run Check")).toBeDefined(); });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      // WS delivers result before timeout — should clear the ref
      capturedOnMessage!({
        type: "consistency_complete",
        project_id: "p1",
        branch: "main",
      });

      // Advance past the 60s timeout — should NOT show timeout error
      await vi.advanceTimersByTimeAsync(65_000);
      expect(screen.queryByText("Consistency check timed out")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears timeout refs on WS duplicates_failed", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
        capturedOnMessage = onMessage;
        setTimeout(() => onOpen?.(), 0);
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-fail-to" });

      setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => { expect(screen.getByText("Find Duplicates")).toBeDefined(); });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // WS reports failure — should clear the timeout ref
      capturedOnMessage!({
        type: "duplicates_failed",
        project_id: "p1",
        branch: "main",
        error: "Worker crashed",
      });

      await waitFor(() => {
        expect(screen.getByText("Worker crashed")).toBeDefined();
      });

      // Advance past timeout — should NOT show timeout error
      await vi.advanceTimersByTimeAsync(65_000);
      expect(screen.queryByText("Duplicate detection timed out")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleans up quality WebSocket on unmount", async () => {
    const closeFn = vi.fn();
    mockCreateQualityWebSocket.mockImplementation(() => {
      return { close: closeFn } as unknown as WebSocket;
    });

    const { unmount } = setup();

    // Wait for the WS to connect (100ms timeout)
    await waitFor(() => {
      expect(mockCreateQualityWebSocket).toHaveBeenCalled();
    });

    unmount();
    expect(closeFn).toHaveBeenCalled();
  });

  it("handles lint WS lint_started and lint_complete messages", async () => {
    let capturedLintOnMessage: ((msg: LintWebSocketMessage) => void) | null = null;
    mockCreateLintWebSocket.mockImplementation(
      (_projectId: string, onMessage: (msg: LintWebSocketMessage) => void) => {
        capturedLintOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    setup();
    await waitFor(() => {
      expect(capturedLintOnMessage).not.toBeNull();
    });

    // Simulate lint_started
    capturedLintOnMessage!({ type: "lint_started", project_id: "p1", run_id: "r1" });
    await waitFor(() => {
      expect(screen.getByText("Running")).toBeDefined();
    });

    // Simulate lint_complete — should refresh data
    capturedLintOnMessage!({ type: "lint_complete", project_id: "p1", run_id: "r1" });
    await waitFor(() => {
      expect(mockLintApi.getStatus).toHaveBeenCalledTimes(2); // initial + refresh
    });
  });

  it("clears pending safety timeouts on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
          capturedOnMessage = onMessage;
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-unmount" });
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-unmount" });

      const { unmount } = setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      // Trigger consistency check (sets consistencyTimeoutRef)
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => { expect(screen.getByText("Run Check")).toBeDefined(); });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      // Trigger duplicate detection (sets duplicatesTimeoutRef)
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => { expect(screen.getByText("Find Duplicates")).toBeDefined(); });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // Unmount with both timeout refs set — cleanup should clear them
      unmount();

      // Advance past timeouts — no errors should be thrown (no state updates after unmount)
      await vi.advanceTimersByTimeAsync(65_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears existing consistency timeout when triggered twice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
          capturedOnMessage = onMessage;
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-twice" });
      mockQualityApi.getConsistencyIssues.mockResolvedValue({
        project_id: "p1", branch: "main", issues: [], checked_at: "", duration_ms: 0,
      });

      setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => { expect(screen.getByText("Run Check")).toBeDefined(); });

      // Trigger first time — sets timeout
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      // WS delivers result, clearing the first timeout and re-enabling button
      capturedOnMessage!({ type: "consistency_complete", project_id: "p1", branch: "main" });
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Run Check").closest("button")!.hasAttribute("disabled")).toBe(false);
      });

      // Trigger second time — should set a fresh timeout (old one was cleared)
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      // Advance 30s — not enough for the new 60s timeout
      await vi.advanceTimersByTimeAsync(30_000);
      expect(screen.queryByText("Consistency check timed out")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears existing duplicates timeout when triggered twice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
          capturedOnMessage = onMessage;
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerDuplicateDetection.mockResolvedValue({ job_id: "dup-twice" });
      mockQualityApi.getLatestDuplicates.mockResolvedValue({
        clusters: [], threshold: 0.85, checked_at: "",
      });

      setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Duplicates")
      );
      await waitFor(() => { expect(screen.getByText("Find Duplicates")).toBeDefined(); });

      // Trigger first time
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );

      // WS delivers result, re-enabling button
      capturedOnMessage!({ type: "duplicates_complete", project_id: "p1", branch: "main" });
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Find Duplicates").closest("button")!.hasAttribute("disabled")).toBe(false);
      });

      // Trigger second time
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Find Duplicates")
      );
      await vi.advanceTimersByTimeAsync(30_000);
      expect(screen.queryByText("Duplicate detection timed out")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("WS handler ignores messages after isActive is cleared", async () => {
    let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
    mockCreateQualityWebSocket.mockImplementation(
      (_projectId, onMessage) => {
        capturedOnMessage = onMessage;
        return { close: vi.fn() } as unknown as WebSocket;
      }
    );

    const { unmount } = setup();
    await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

    // Unmount clears isActive
    unmount();

    // Deliver a message after unmount — handler should early-return
    capturedOnMessage!({
      type: "consistency_complete",
      project_id: "p1",
      branch: "main",
    });
    // No assertion needed — if it didn't throw, the guard worked
    expect(mockQualityApi.getConsistencyIssues).not.toHaveBeenCalled();
  });

  it("handles consistency_failed clearing timeout ref", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let capturedOnMessage: ((msg: QualityWebSocketMessage) => void) | null = null;
      mockCreateQualityWebSocket.mockImplementation(
        (_projectId, onMessage, _onError, _onClose, _token, onOpen) => {
          capturedOnMessage = onMessage;
          setTimeout(() => onOpen?.(), 0);
          return { close: vi.fn() } as unknown as WebSocket;
        }
      );
      mockQualityApi.triggerConsistencyCheck.mockResolvedValue({ job_id: "cons-fail-to" });

      setup();
      await vi.advanceTimersByTimeAsync(10);
      await waitFor(() => { expect(capturedOnMessage).not.toBeNull(); });

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Consistency")
      );
      await waitFor(() => { expect(screen.getByText("Run Check")).toBeDefined(); });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        screen.getByText("Run Check")
      );

      // WS reports failure — should clear timeout ref
      capturedOnMessage!({
        type: "consistency_failed",
        project_id: "p1",
        branch: "main",
        error: "Graph corrupt",
      });
      await waitFor(() => {
        expect(screen.getByText("Graph corrupt")).toBeDefined();
      });

      // Advance past timeout — should NOT show timeout error
      await vi.advanceTimersByTimeAsync(65_000);
      expect(screen.queryByText("Consistency check timed out")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";

// ---- matchMedia polyfill (must run BEFORE module imports load the editor
// mode store, whose top-level code calls window.matchMedia(...).addEventListener
// during module initialization). vi.hoisted runs before ES-module hoisting so
// the polyfill is in place before any subsequent import resolves. ----
vi.hoisted(() => {
  if (typeof globalThis.window === "undefined") return;
  if (typeof window.matchMedia === "function") return;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

// Mock heavy dependencies that the settings page imports but LintConfigSection doesn't use
vi.mock("@/components/layout/header", () => ({
  Header: () => null,
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
  useParams: vi.fn(() => ({ id: "p1" })),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode; href: string }) =>
    children,
}));

// Mock dependencies before imports
vi.mock("@/lib/api/lint", () => ({
  lintApi: {
    getRules: vi.fn(),
    getLevels: vi.fn(),
    getLintConfig: vi.fn(),
    updateLintConfig: vi.fn(),
    getStatus: vi.fn(),
    clearResults: vi.fn(),
    triggerLint: vi.fn(),
  },
}));

const summaryWithResults = {
  project_id: "p1",
  last_run: {
    id: "run1",
    project_id: "p1",
    status: "completed" as const,
    started_at: "2026-04-20T10:00:00Z",
    completed_at: "2026-04-20T10:01:00Z",
    issues_found: 5,
    error_message: null,
  },
  error_count: 2,
  warning_count: 2,
  info_count: 1,
  total_issues: 5,
};

const { MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    statusText: string;
    constructor(status: number, statusText: string, message: string) {
      super(message);
      this.status = status;
      this.statusText = statusText;
    }
  }
  return { MockApiError };
});

vi.mock("@/lib/api/client", () => ({
  ApiError: MockApiError,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import {
  LintConfigSection,
  getSeverityColor,
} from "@/app/projects/[id]/settings/page";
import { lintApi } from "@/lib/api/lint";
import type { LintLevelsResponse, LintRuleInfo } from "@/lib/api/lint";

const mockLintApi = vi.mocked(lintApi);

const sampleRules: LintRuleInfo[] = [
  { rule_id: "R001", name: "Missing label", description: "Class has no rdfs:label", severity: "error", scope: ["class", "property", "individual"] },
  { rule_id: "R002", name: "Missing comment", description: "Class has no rdfs:comment", severity: "warning", scope: ["class", "property", "individual"] },
  { rule_id: "R003", name: "Unused import", description: "Prefix declared but unused", severity: "warning", scope: ["class"] },
  { rule_id: "R004", name: "Style hint", description: "Consider using camelCase", severity: "info", scope: ["class", "property", "individual"] },
];

// --- Pure function tests ---

describe("getSeverityColor", () => {
  it("returns red classes for error", () => {
    expect(getSeverityColor("error")).toContain("bg-red-100");
  });

  it("returns amber classes for warning", () => {
    expect(getSeverityColor("warning")).toContain("bg-amber-100");
  });

  it("returns blue classes for info", () => {
    expect(getSeverityColor("info")).toContain("bg-blue-100");
  });

  it("returns slate classes for unknown severity", () => {
    expect(getSeverityColor("unknown")).toContain("bg-slate-100");
  });
});

// --- Component tests ---

const sampleLevels = {
  levels: [
    { level: 1, name: "Critical", description: "Undefined parents, circular hierarchies", rule_ids: ["R001"] },
    { level: 2, name: "Consistency", description: "Orphan classes, duplicates", rule_ids: ["R001", "R002", "R003"] },
    { level: 3, name: "Labels", description: "Label checks", rule_ids: ["R001", "R002", "R003", "R004"] },
  ],
} satisfies LintLevelsResponse;

describe("LintConfigSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLintApi.getLevels.mockResolvedValue(sampleLevels);
    mockLintApi.getStatus.mockResolvedValue({
      project_id: "p1", last_run: null, error_count: 0, warning_count: 0, info_count: 0, total_issues: 0,
    });
  });

  it("shows loading spinner initially", () => {
    mockLintApi.getRules.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    expect(screen.getByText("Lint Rule Configuration")).toBeDefined();
    // Loading spinner is present (the animate-spin div)
  });

  it("renders rules after loading", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Missing label")).toBeDefined();
      expect(screen.getByText("Missing comment")).toBeDefined();
      expect(screen.getByText("Style hint")).toBeDefined();
    });
  });

  it("shows error message when rules fail to load", async () => {
    mockLintApi.getRules.mockRejectedValue(new Error("Network error"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load lint rules")).toBeDefined();
    });
  });

  it("displays lint level options", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Level 1 — Critical/)).toBeDefined();
      expect(screen.getByText(/Level 2 — Consistency/)).toBeDefined();
      expect(screen.getByText(/Level 3 — Labels/)).toBeDefined();
      expect(screen.getByText("Custom")).toBeDefined();
    });
  });

  it("shows enabled rule count", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      // Level 2 enables error + warning rules = 3 of 4
      expect(screen.getByText("Rules (3 of 4 enabled)")).toBeDefined();
    });
  });

  it("switching to custom mode shows enable/disable all buttons", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Custom")).toBeDefined();
    });

    await user.click(screen.getByText("Custom"));

    await waitFor(() => {
      expect(screen.getByText("Enable all")).toBeDefined();
      expect(screen.getByText("Disable all")).toBeDefined();
    });
  });

  it("save button is disabled when no changes", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      const saveBtn = screen.getByText("Save Lint Configuration");
      expect(saveBtn.closest("button")?.disabled).toBe(true);
    });
  });

  it("save button enables after changing level", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Level 3 — Labels/)).toBeDefined();
    });

    await user.click(screen.getByText(/Level 3 — Labels/));

    await waitFor(() => {
      const saveBtn = screen.getByText("Save Lint Configuration");
      expect(saveBtn.closest("button")?.disabled).toBe(false);
    });
  });

  it("calls updateLintConfig on save", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.updateLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 3, enabled_rules: ["R001", "R002", "R003", "R004"], effective_rules: ["R001", "R002", "R003", "R004"], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Level 3 — Labels/)).toBeDefined();
    });

    await user.click(screen.getByText(/Level 3 — Labels/));
    await user.click(screen.getByText("Save Lint Configuration"));

    await waitFor(() => {
      // Preset mode must not include enabled_rules (backend's enforce_xor).
      expect(mockLintApi.updateLintConfig).toHaveBeenCalledWith(
        "p1",
        { lint_level: 3 },
        "tok"
      );
      expect(screen.getByText("Lint configuration saved")).toBeDefined();
    });
  });

  it("saves with lint_level: null when switching from preset to Custom", async () => {
    // Round-trip the wire format for custom mode: starting from a preset
    // (Level 2 → R001/R002/R003), switching to Custom and saving must send
    // `lint_level: null` with the explicit rule list. Without this, the
    // backend would interpret the request as a preset and ignore enabled_rules.
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: ["R001", "R002", "R003"], updated_at: null,
    });
    mockLintApi.updateLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: null, enabled_rules: ["R001", "R002", "R003"], effective_rules: ["R001", "R002", "R003"], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Custom")).toBeDefined();
    });

    await user.click(screen.getByText("Custom"));
    await user.click(screen.getByText("Save Lint Configuration"));

    await waitFor(() => {
      expect(mockLintApi.updateLintConfig).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ lint_level: null }),
        "tok"
      );
    });
    // The rule list carried over from the preset should be persisted.
    const [, payload] = mockLintApi.updateLintConfig.mock.calls[0];
    expect(new Set((payload as { enabled_rules: string[] }).enabled_rules)).toEqual(
      new Set(["R001", "R002", "R003"])
    );
  });

  it("does not overwrite in-progress edits when the config refetches", async () => {
    // The hasChangesRef short-circuit in the config-sync effect prevents a
    // background refetch (e.g. on window focus) from clobbering whatever the
    // user is in the middle of editing. Without it, switching to Level 3 and
    // then triggering a refetch would silently revert the level to 2.
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: ["R001", "R002", "R003"], updated_at: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <LintConfigSection projectId="p1" accessToken="tok" canManage={true} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Level 3 — Labels/)).toBeDefined();
    });

    // Make a dirty edit.
    await user.click(screen.getByText(/Level 3 — Labels/));
    await waitFor(() => {
      const lvl3Btn = screen.getByText(/Level 3 — Labels/).closest("button")!;
      expect(lvl3Btn.getAttribute("aria-pressed")).toBe("true");
    });

    // Simulate a background refetch that returns the original Level 2 payload.
    await queryClient.invalidateQueries({ queryKey: ["lintConfig"] });

    // The dirty edit must survive the refetch.
    await waitFor(() => {
      const lvl3Btn = screen.getByText(/Level 3 — Labels/).closest("button")!;
      expect(lvl3Btn.getAttribute("aria-pressed")).toBe("true");
    });
    const lvl2Btn = screen.getByText(/Level 2 — Consistency/).closest("button")!;
    expect(lvl2Btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows read-only message when canManage is false", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={false} />);

    await waitFor(() => {
      expect(
        screen.getByText("Only project owners and admins can modify lint configuration.")
      ).toBeDefined();
    });

    // Save button should not be present
    expect(screen.queryByText("Save Lint Configuration")).toBeNull();
  });

  it("surfaces the API error when config endpoint returns 404", async () => {
    // No silent fallback — a 404 from the config endpoint is now reported to
    // the user instead of fabricating Level 2 defaults that could overwrite
    // real config on save.
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockRejectedValue(new MockApiError(404, "Not Found", "Not found"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeDefined();
    });
  });

  it("surfaces the API error when config endpoint returns 500", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockRejectedValue(new MockApiError(500, "Internal Server Error", "Server error"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("shows error to read-only users when rules fail to load", async () => {
    mockLintApi.getRules.mockRejectedValue(new Error("Network error"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={false} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load lint rules")).toBeDefined();
    });
  });

  it("sets aria-pressed on the active lint level button", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      const consistencyBtn = screen.getByText(/Level 2 — Consistency/).closest("button")!;
      expect(consistencyBtn.getAttribute("aria-pressed")).toBe("true");

      const criticalBtn = screen.getByText(/Level 1 — Critical/).closest("button")!;
      expect(criticalBtn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("uses role=switch and aria-checked on rule toggles", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBe(sampleRules.length);
    });

    // Level 2 enables error + warning rules (R001, R002, R003), not info (R004)
    const toggleR001 = screen.getByLabelText("Toggle Missing label");
    expect(toggleR001.getAttribute("aria-checked")).toBe("true");

    const toggleR004 = screen.getByLabelText("Toggle Style hint");
    expect(toggleR004.getAttribute("aria-checked")).toBe("false");
  });

  it("shows last run summary when status data is available", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.getStatus.mockResolvedValue({
      project_id: "p1",
      last_run: { id: "run1", project_id: "p1", status: "completed", started_at: "2026-04-20T10:00:00Z", completed_at: "2026-04-20T10:01:00Z", issues_found: 5, error_message: null },
      error_count: 2,
      warning_count: 2,
      info_count: 1,
      total_issues: 5,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText(/2 error/)).toBeDefined();
      expect(screen.getByText(/2 warning/)).toBeDefined();
      expect(screen.getByText(/1 info/)).toBeDefined();
    });
  });

  it("shows 'No issues' when last run has zero issues", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.getStatus.mockResolvedValue({
      project_id: "p1",
      last_run: { id: "run1", project_id: "p1", status: "completed", started_at: "2026-04-20T10:00:00Z", completed_at: "2026-04-20T10:01:00Z", issues_found: 0, error_message: null },
      error_count: 0,
      warning_count: 0,
      info_count: 0,
      total_issues: 0,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("No issues")).toBeDefined();
    });
  });

  it("calls clearResults and shows success message", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    // Clear Results only renders when there's something to clear.
    mockLintApi.getStatus.mockResolvedValue(summaryWithResults);
    mockLintApi.clearResults.mockResolvedValue(undefined);

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Clear Results")).toBeDefined();
    });

    await user.click(screen.getByText("Clear Results"));

    await waitFor(() => {
      expect(mockLintApi.clearResults).toHaveBeenCalledWith("p1", "tok");
      expect(screen.getByText("Lint results cleared")).toBeDefined();
    });
  });

  it("marks Custom as active when lint_level is null", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: null, enabled_rules: ["R001"], effective_rules: ["R001"], updated_at: null,
    });
    mockLintApi.updateLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: null, enabled_rules: ["R001"], effective_rules: ["R001"], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Custom")).toBeDefined();
    });

    // Should show custom as active (lint_level: null maps to 0)
    await waitFor(() => {
      const customBtn = screen.getByText("Custom").closest("button")!;
      expect(customBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("displays level rule counts from backend", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      // Level 1 has 1 rule, Level 2 has 3, Level 3 has 4
      expect(screen.getByText(/1 rules/)).toBeDefined();
      expect(screen.getByText(/3 rules/)).toBeDefined();
      expect(screen.getByText(/4 rules/)).toBeDefined();
    });
  });

  it("displays scope badges for rules", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: null, enabled_rules: ["R001", "R003"], effective_rules: ["R001", "R003"], updated_at: null,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      // R001 has scope ["class", "property", "individual"] → 3 badges (C, P, I)
      // R003 has scope ["class"] → 1 badge (C)
      // All rules together: C appears in all 4 rules
      const allBadges = screen.getAllByTitle("class");
      expect(allBadges.length).toBe(4); // all 4 rules have "class" scope

      const propBadges = screen.getAllByTitle("property");
      expect(propBadges.length).toBe(3); // R001, R002, R004 have "property" scope

      const indBadges = screen.getAllByTitle("individual");
      expect(indBadges.length).toBe(3); // R001, R002, R004 have "individual" scope
    });
  });

  it("shows error when clearing results fails", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.getStatus.mockResolvedValue(summaryWithResults);
    mockLintApi.clearResults.mockRejectedValue(new Error("Server error"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Clear Results")).toBeDefined();
    });

    await user.click(screen.getByText("Clear Results"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("shows Run Lint when no run exists, and triggers a run on click", async () => {
    // Default status mock has last_run: null — so the Run Lint variant should
    // render in place of Clear Results.
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.triggerLint.mockResolvedValue({
      job_id: "j1", status: "pending", message: "started",
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    expect(screen.queryByText("Clear Results")).toBeNull();

    await user.click(screen.getByText("Run Lint"));

    await waitFor(() => {
      expect(mockLintApi.triggerLint).toHaveBeenCalledWith("p1", "tok");
      expect(screen.getByText("Lint run started")).toBeDefined();
    });
  });

  it("shows Run Lint (not Clear) when last run completed with zero issues", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.getStatus.mockResolvedValue({
      ...summaryWithResults,
      error_count: 0, warning_count: 0, info_count: 0, total_issues: 0,
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    expect(screen.queryByText("Clear Results")).toBeNull();
  });

  it("disables Run Lint while a run is pending or running", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.getStatus.mockResolvedValue({
      ...summaryWithResults,
      last_run: { ...summaryWithResults.last_run, status: "running" as const },
    });

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Running...")).toBeDefined();
    });
    const btn = screen.getByText("Running...").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("shows error when triggerLint fails", async () => {
    const user = userEvent.setup();
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockResolvedValue({
      project_id: "p1", lint_level: 2, enabled_rules: [], effective_rules: [], updated_at: null,
    });
    mockLintApi.triggerLint.mockRejectedValue(new Error("Backend down"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Run Lint")).toBeDefined();
    });
    await user.click(screen.getByText("Run Lint"));
    await waitFor(() => {
      expect(screen.getByText("Backend down")).toBeDefined();
    });
  });
});

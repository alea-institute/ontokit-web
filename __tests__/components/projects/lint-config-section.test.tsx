import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";

// ---- matchMedia polyfill (must be before any import that touches the store) ----
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
  },
}));

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
  getRulesForLevel,
  getSeverityColor,
} from "@/app/projects/[id]/settings/page";
import { lintApi } from "@/lib/api/lint";
import type { LintRuleInfo } from "@/lib/api/lint";

const mockLintApi = vi.mocked(lintApi);

const sampleRules: LintRuleInfo[] = [
  { rule_id: "R001", name: "Missing label", description: "Class has no rdfs:label", severity: "error" },
  { rule_id: "R002", name: "Missing comment", description: "Class has no rdfs:comment", severity: "warning" },
  { rule_id: "R003", name: "Unused import", description: "Prefix declared but unused", severity: "warning" },
  { rule_id: "R004", name: "Style hint", description: "Consider using camelCase", severity: "info" },
];

// --- Pure function tests ---

describe("getRulesForLevel", () => {
  it("level 1 returns only error-severity rules", () => {
    const result = getRulesForLevel(sampleRules, 1);
    expect(result).toEqual(["R001"]);
  });

  it("level 2 returns error and warning rules", () => {
    const result = getRulesForLevel(sampleRules, 2);
    expect(result).toEqual(["R001", "R002", "R003"]);
  });

  it("level 3 returns all rules", () => {
    const result = getRulesForLevel(sampleRules, 3);
    expect(result).toEqual(["R001", "R002", "R003", "R004"]);
  });

  it("level 4 returns all rules", () => {
    const result = getRulesForLevel(sampleRules, 4);
    expect(result).toEqual(["R001", "R002", "R003", "R004"]);
  });

  it("level 5 returns all rules", () => {
    const result = getRulesForLevel(sampleRules, 5);
    expect(result).toEqual(["R001", "R002", "R003", "R004"]);
  });

  it("level 0 (custom) returns empty array", () => {
    const result = getRulesForLevel(sampleRules, 0);
    expect(result).toEqual([]);
  });

  it("handles empty rules array", () => {
    expect(getRulesForLevel([], 2)).toEqual([]);
  });
});

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
};

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
      expect(mockLintApi.updateLintConfig).toHaveBeenCalledWith(
        "p1",
        { lint_level: 3, enabled_rules: ["R001", "R002", "R003", "R004"] },
        "tok"
      );
      expect(screen.getByText("Lint configuration saved")).toBeDefined();
    });
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

  it("falls back to defaults when config endpoint returns 404", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockRejectedValue(new MockApiError(404, "Not Found", "Not found"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      // Should default to level 2 (Standard) with error + warning rules enabled
      expect(screen.getByText("Rules (3 of 4 enabled)")).toBeDefined();
    });
  });

  it("shows error when config endpoint returns non-404 error", async () => {
    mockLintApi.getRules.mockResolvedValue({ rules: sampleRules });
    mockLintApi.getLintConfig.mockRejectedValue(new MockApiError(500, "Internal Server Error", "Server error"));

    renderWithQueryClient(<LintConfigSection projectId="p1" accessToken="tok" canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load lint rules")).toBeDefined();
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
});

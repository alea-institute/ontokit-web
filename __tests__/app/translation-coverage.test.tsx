import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const previewBackfill = vi.fn();
const launchBackfill = vi.fn();
const coverageState = vi.hoisted(() => ({
  projectRole: "admin",
  launchError: null as Error | null,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const previewResult = (literalCount: number, expectedCost: number) => ({
  literal_count: literalCount,
  expected_cost_usd: expectedCost,
  upper_bound_cost_usd: expectedCost * 2,
  batch_discount_applied: true,
});

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "token" }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
}));
vi.mock("@/components/layout/header", () => ({ Header: () => <header /> }));
vi.mock("@/lib/hooks/useProjectHomeHref", () => ({
  useProjectHomeHref: () => "/projects/project-1",
}));
vi.mock("@/lib/context/BranchContext", () => ({
  BranchProvider: ({ children }: { children: React.ReactNode }) => children,
  useBranch: () => ({ currentBranch: "main" }),
}));
vi.mock("@/lib/hooks/useProject", () => ({
  useProject: () => ({
    project: { id: "project-1", name: "Ontology", user_role: coverageState.projectRole },
    isLoading: false,
    error: null,
  }),
  derivePermissions: () => ({ canManage: coverageState.projectRole === "admin" }),
}));
vi.mock("@/lib/hooks/useTranslationCoverage", () => ({
  useTranslationCoverage: () => ({
    coverage: {
      branch: "main",
      total_entities: 10,
      languages: [
        { language: "fr", verified: 6, provisional: 1, pending: 2, missing: 1, total: 10 },
      ],
    },
    isLoading: false,
    error: null,
    preview: null,
    isPreviewing: false,
    previewBackfill,
    launchBackfill,
    isLaunching: false,
    launchError: coverageState.launchError,
    job: null,
  }),
}));

import TranslationCoveragePage from "@/app/projects/[id]/translations/page";

describe("Translation coverage page", () => {
  beforeEach(() => {
    previewBackfill.mockReset();
    launchBackfill.mockReset();
    coverageState.projectRole = "admin";
    coverageState.launchError = null;
  });

  it("renders pending coverage in an accessible keyboard-navigable table", () => {
    render(<TranslationCoveragePage />);

    const table = screen.getByRole("table", { name: /translation coverage/i });
    expect(table.querySelectorAll("thead th[scope='col']")).toHaveLength(6);
    expect(table.querySelector("tbody th[scope='row']")?.textContent).toContain("fr");
    expect(screen.getByRole("cell", { name: /pending: 2/i })).toBeDefined();
    expect(table.getAttribute("tabindex")).toBe("0");
  });

  it("keeps confirmation disabled until a cost preview is available", async () => {
    let finishPreview: (value: unknown) => void = () => undefined;
    previewBackfill.mockReturnValue(new Promise((resolve) => { finishPreview = resolve; }));
    const user = userEvent.setup();
    render(<TranslationCoveragePage />);

    const confirm = screen.getByRole("button", { name: /confirm backfill/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /preview cost/i }));
    expect(confirm.disabled).toBe(true);
    finishPreview({
      literal_count: 42,
      expected_cost_usd: 1.25,
      upper_bound_cost_usd: 2.5,
      batch_discount_applied: true,
    });
    expect(await screen.findByText(/\$1\.25/)).toBeDefined();
    expect(confirm.disabled).toBe(false);
  });

  it("round-trips era filters in the launch and surfaces an active-job conflict", async () => {
    previewBackfill.mockResolvedValue({
      literal_count: 3,
      expected_cost_usd: 0.3,
      upper_bound_cost_usd: 0.5,
      batch_discount_applied: true,
    });
    launchBackfill.mockImplementation(async () => {
      // Mirror the real hook: the mutation records the error the page renders.
      const err = new ApiError(409, "Conflict", "active");
      coverageState.launchError = err;
      throw err;
    });
    const user = userEvent.setup();
    render(<TranslationCoveragePage />);

    await user.type(screen.getByLabelText(/language/i), "fr");
    await user.type(screen.getByLabelText(/produced before/i), "2026-12-31");
    await user.click(screen.getByLabelText(/never native-confirmed/i));
    await user.click(screen.getByRole("button", { name: /preview cost/i }));
    await screen.findByText(/\$0\.30/);
    await user.click(screen.getByRole("button", { name: /confirm backfill/i }));

    expect(launchBackfill).toHaveBeenCalledWith({
      branch: "main",
      language: "fr",
      era_before: "2026-12-31",
      never_confirmed: true,
    });
    // The mocked hook is not reactive; nudge a re-render so the page reads
    // the mutation error the real React Query subscription would push.
    await user.type(screen.getByLabelText(/language/i), "r");
    expect((await screen.findByRole("alert")).textContent).toMatch(/already active/i);
  });

  it("ignores a stale preview response after a newer request completes", async () => {
    const first = deferred<ReturnType<typeof previewResult>>();
    const second = deferred<ReturnType<typeof previewResult>>();
    previewBackfill
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<TranslationCoveragePage />);

    await user.type(screen.getByLabelText(/language/i), "fr");
    await user.click(screen.getByRole("button", { name: /preview cost/i }));
    await user.clear(screen.getByLabelText(/language/i));
    await user.type(screen.getByLabelText(/language/i), "es");
    await user.click(screen.getByRole("button", { name: /preview cost/i }));

    await act(async () => {
      second.resolve(previewResult(20, 2));
      await second.promise;
    });
    expect(await screen.findByText(/\$2\.00/)).toBeDefined();
    await act(async () => {
      first.resolve(previewResult(10, 1));
      await first.promise;
    });
    expect(screen.queryByText(/\$1\.00/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /confirm backfill/i }));
    expect(launchBackfill).toHaveBeenCalledWith({
      branch: "main",
      language: "es",
      era_before: undefined,
      never_confirmed: undefined,
    });
  });

  it("invalidates an in-flight preview when a filter changes", async () => {
    const pending = deferred<ReturnType<typeof previewResult>>();
    previewBackfill.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<TranslationCoveragePage />);

    await user.type(screen.getByLabelText(/language/i), "fr");
    await user.click(screen.getByRole("button", { name: /preview cost/i }));
    await user.clear(screen.getByLabelText(/language/i));
    await user.type(screen.getByLabelText(/language/i), "es");
    await act(async () => {
      pending.resolve(previewResult(10, 1));
      await pending.promise;
    });

    expect(screen.queryByText(/\$1\.00/)).toBeNull();
    expect((screen.getByRole("button", { name: /confirm backfill/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show launch controls to non-admin project members", () => {
    coverageState.projectRole = "viewer";
    render(<TranslationCoveragePage />);
    expect(screen.queryByRole("button", { name: /preview cost/i })).toBeNull();
    expect(screen.getByText(/project administrator can launch/i)).toBeDefined();
  });
});

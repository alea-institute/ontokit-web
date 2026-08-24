import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listProvisional, getMyReviewerLanguages, confirmRecord, rejectRecord, confirmBulk } = vi.hoisted(() => ({
  listProvisional: vi.fn(),
  getMyReviewerLanguages: vi.fn(),
  confirmRecord: vi.fn(),
  rejectRecord: vi.fn(),
  confirmBulk: vi.fn(),
}));
const state = vi.hoisted(() => ({ projectRole: "viewer" }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "token" }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "project-1" }) }));
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
    project: { id: "project-1", name: "Ontology", user_role: state.projectRole },
    isLoading: false,
    error: null,
  }),
  derivePermissions: () => ({ canManage: state.projectRole === "admin" }),
}));
vi.mock("@/lib/api/translations", () => ({
  translationsApi: {
    listProvisional,
    getMyReviewerLanguages,
    confirmRecord,
    rejectRecord,
    confirmBulk,
  },
  getTranslationErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));

import TranslationReviewPage from "@/app/projects/[id]/translations/review/page";

function render(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const swahili = {
  record_id: "sw-1",
  entity_iri: "https://example.test/Bailment",
  predicate: "rdfs:label",
  language: "sw",
  source_value: "Bailment",
  proposed_value: "Dhamana",
  model_name: "gpt-5",
  method: "consensus",
  score: 0.94,
  created_at: "2026-08-09T12:00:00Z",
};
const french = { ...swahili, record_id: "fr-1", language: "fr", proposed_value: "Dépôt" };

describe("Translation review queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.projectRole = "viewer";
    getMyReviewerLanguages.mockResolvedValue({ languages: ["sw"] });
    listProvisional.mockResolvedValue([swahili]);
    confirmRecord.mockResolvedValue({ record_id: "sw-1", status: "verified" });
    rejectRecord.mockResolvedValue({ record_id: "sw-1", status: "rejected" });
    confirmBulk.mockResolvedValue({ results: [] });
  });

  it("shows a tagged reviewer only their language queue with actions enabled", async () => {
    const user = userEvent.setup();
    render(<TranslationReviewPage />);

    expect(await screen.findByText("Dhamana")).toBeDefined();
    expect(screen.queryByText("Dépôt")).toBeNull();
    expect(listProvisional).toHaveBeenCalledWith("project-1", "sw", "main", "token");
    expect((screen.getByRole("button", { name: /confirm dhamana/i }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByLabelText(/select dhamana/i));
    expect((screen.getByRole("button", { name: /confirm selected/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("lets an untagged admin view rows but not confirm or reject them", async () => {
    state.projectRole = "admin";
    getMyReviewerLanguages.mockResolvedValue({ languages: [] });
    listProvisional.mockResolvedValue([swahili, french]);
    render(<TranslationReviewPage />);

    expect(await screen.findByText("Dhamana")).toBeDefined();
    expect(screen.getByText("Dépôt")).toBeDefined();
    expect(listProvisional).toHaveBeenCalledWith("project-1", undefined, "main", "token");
    expect((screen.getByRole("button", { name: /confirm dhamana/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /reject dhamana/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/view-only/i)).toBeDefined();
  });

  it("requires confirmation before reject and removes a rejected row", async () => {
    const user = userEvent.setup();
    render(<TranslationReviewPage />);
    await screen.findByText("Dhamana");

    await user.click(screen.getByRole("button", { name: /reject dhamana/i }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(rejectRecord).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^reject translation$/i }));

    await waitFor(() => expect(rejectRecord).toHaveBeenCalledWith("project-1", "sw-1", "main", "token"));
    await waitFor(() => expect(screen.queryByText("Dhamana")).toBeNull());
    expect(screen.queryByRole("button", { name: /confirm dhamana/i })).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/rejected/i);
  });

  it("requires confirmation before confirming and removes the confirmed row", async () => {
    const user = userEvent.setup();
    render(<TranslationReviewPage />);
    await screen.findByText("Dhamana");

    await user.click(screen.getByRole("button", { name: /confirm dhamana/i }));
    expect(confirmRecord).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^confirm translation$/i }));

    await waitFor(() => expect(confirmRecord).toHaveBeenCalledWith("project-1", "sw-1", "main", "token"));
    await waitFor(() => expect(screen.queryByText("Dhamana")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/confirmed/i);
  });

  it("keeps a row visible with an error when rejection fails", async () => {
    rejectRecord.mockRejectedValue(new Error("Reviewer service unavailable"));
    const user = userEvent.setup();
    render(<TranslationReviewPage />);
    await screen.findByText("Dhamana");

    await user.click(screen.getByRole("button", { name: /reject dhamana/i }));
    await user.click(screen.getByRole("button", { name: /^reject translation$/i }));

    expect((await screen.findAllByText("Reviewer service unavailable")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("Dhamana")).toBeDefined();
  });

  it("retains only bulk-confirm failures and announces each error", async () => {
    listProvisional.mockResolvedValue([swahili, { ...swahili, record_id: "sw-2", proposed_value: "Amana" }]);
    confirmBulk.mockResolvedValue({
      results: [
        { record_id: "sw-1", ok: true, error: null },
        { record_id: "sw-2", ok: false, error: "Translation changed upstream" },
      ],
    });
    const user = userEvent.setup();
    render(<TranslationReviewPage />);
    await screen.findByText("Dhamana");

    await user.click(screen.getByLabelText(/select dhamana/i));
    await user.click(screen.getByLabelText(/select amana/i));
    await user.click(screen.getByRole("button", { name: /confirm selected/i }));
    await user.click(screen.getByRole("button", { name: /^confirm translations$/i }));

    await waitFor(() => expect(confirmBulk).toHaveBeenCalledWith("project-1", ["sw-1", "sw-2"], "main", "token"));
    await waitFor(() => expect(screen.queryByText("Dhamana")).toBeNull());
    const failedRow = screen.getByRole("row", { name: /amana/i });
    expect(within(failedRow).getByText("Translation changed upstream")).toBeDefined();
    expect(screen.getByRole("status").textContent).toMatch(/1 confirmed.*1 failed/i);
  });

  it("renders the reviewer-language empty state", async () => {
    listProvisional.mockResolvedValue([]);
    render(<TranslationReviewPage />);
    expect(await screen.findByText(/no provisional translations for your reviewer languages/i)).toBeDefined();
  });
});

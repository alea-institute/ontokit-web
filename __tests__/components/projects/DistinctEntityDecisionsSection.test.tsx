import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistinctEntityDecisionsSection } from "@/components/projects/DistinctEntityDecisionsSection";
import { distinctDecisionsApi } from "@/lib/api/duplicateCheck";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";

const success = vi.fn();
const error = vi.fn();

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success, error }),
}));

vi.mock("@/lib/api/duplicateCheck", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/duplicateCheck")>();
  return {
    ...original,
    distinctDecisionsApi: {
      list: vi.fn(),
      revoke: vi.fn(),
    },
  };
});

const api = vi.mocked(distinctDecisionsApi);

const activeDecision = {
  id: "decision-1",
  project_id: "project-1",
  iri_a: "http://example.org/EmploymentContract",
  iri_b: "http://example.org/WorkAgreement",
  fingerprint_a: "a".repeat(64),
  fingerprint_b: "b".repeat(64),
  reason: "They have different legal effects.",
  marked_by: "reviewer-1",
  marked_at: "2026-08-23T12:00:00Z",
  suggestion_session_id: null,
  revoked_at: null,
  revoked_by: null,
  superseded_by_id: null,
};

function renderSection() {
  return renderWithQueryClient(
    <DistinctEntityDecisionsSection projectId="project-1" accessToken="token-1" />,
  );
}

describe("DistinctEntityDecisionsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([activeDecision]);
    api.revoke.mockResolvedValue({
      ...activeDecision,
      revoked_at: "2026-08-23T13:00:00Z",
      revoked_by: "owner-1",
    });
  });

  it("shows the decision context and preserves an explicit revocation confirmation", async () => {
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText("EmploymentContract")).toBeDefined();
    expect(screen.getByText("WorkAgreement")).toBeDefined();
    expect(screen.getByText("They have different legal effects.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.getByText(/prior decision remains in the audit history/i)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Revoke decision" }));

    await waitFor(() => {
      expect(api.revoke).toHaveBeenCalledWith("project-1", "decision-1", "token-1");
    });
    expect(success).toHaveBeenCalledWith(
      "Distinct decision revoked",
      "The duplicate detector will evaluate this pair again.",
    );
  });

  it("requests bounded inactive history only when the user asks for it", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("EmploymentContract");

    expect(api.list).toHaveBeenCalledWith("project-1", "token-1", { includeInactive: false });
    await user.click(screen.getByRole("button", { name: "Show history" }));

    await waitFor(() => {
      expect(api.list).toHaveBeenCalledWith("project-1", "token-1", { includeInactive: true });
    });
  });
});

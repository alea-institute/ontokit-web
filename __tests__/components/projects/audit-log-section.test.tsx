import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";
import type { SuggestionOutcomeItem } from "@/lib/api/trust";

vi.mock("@/lib/hooks/useSuggestionOutcomes", () => ({
  useSuggestionOutcomes: vi.fn(),
}));

import { useSuggestionOutcomes } from "@/lib/hooks/useSuggestionOutcomes";
import { AuditLogSection } from "@/components/projects/AuditLogSection";

const mockedUseSuggestionOutcomes = useSuggestionOutcomes as unknown as ReturnType<typeof vi.fn>;

function outcome(overrides: Partial<SuggestionOutcomeItem> = {}): SuggestionOutcomeItem {
  return {
    user_id: "user-raw-id",
    is_anonymous: false,
    submitter_name: "Ada Lovelace",
    submitter_email: "ada@example.com",
    snapshot_tier: "trusted",
    snapshot_role: "member",
    snapshot_captured_at: "2026-08-10T15:00:00Z",
    outcome: "accepted",
    decided_by: "reviewer-id",
    decided_by_name: "Grace Hopper",
    created_at: "2026-08-10T16:00:00Z",
    ...overrides,
  };
}

function mockQuery(items: SuggestionOutcomeItem[], total = items.length) {
  mockedUseSuggestionOutcomes.mockReturnValue({
    items,
    total,
    next_cursor: items.length < total ? "next" : null,
    isLoading: false,
    isError: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery([]);
});

describe("AuditLogSection", () => {
  it("renders the pre-feature no-snapshot marker", () => {
    mockQuery([outcome({ snapshot_tier: null, snapshot_captured_at: null })]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(
      screen.getByTitle("Recorded before audit snapshots were captured").textContent,
    ).toBe("—");
  });

  it("renders three distinct null-tier states", () => {
    mockQuery([
      outcome({
        user_id: null,
        is_anonymous: true,
        submitter_name: "Anonymous Author",
        snapshot_tier: null,
        snapshot_role: null,
      }),
      outcome({
        user_id: "legacy-user",
        submitter_name: "Legacy User",
        snapshot_tier: null,
        snapshot_captured_at: null,
      }),
      outcome({
        user_id: "failed-user",
        submitter_name: "Failed Capture",
        snapshot_tier: null,
      }),
    ]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    const anonymous = screen.getByText("Anonymous", { selector: "span" });
    const preFeature = screen.getByTitle("Recorded before audit snapshots were captured");
    const captureFailed = screen.getByText("Capture failed");
    expect(anonymous).not.toBe(preFeature);
    expect(preFeature).not.toBe(captureFailed);
    expect(captureFailed).not.toBe(anonymous);
  });

  it("renders the forward-only empty state", () => {
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByRole("heading", { name: "No decided outcomes yet" })).toBeDefined();
    expect(screen.getByText(/audit trail records from today forward/)).toBeDefined();
  });

  it("renders nothing for non-managers and rows for managers", () => {
    mockQuery([outcome()]);
    const { container, rerender } = renderWithQueryClient(
      <AuditLogSection projectId="p1" accessToken="tok" canManage={false} />,
    );
    expect(container.innerHTML).toBe("");

    rerender(<AuditLogSection projectId="p1" accessToken="tok" canManage />);
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
  });

  it("shows anonymous attribution and the Anonymous chip without a tier badge", () => {
    mockQuery([
      outcome({
        user_id: null,
        is_anonymous: true,
        submitter_name: "Self Reported Name",
        submitter_email: "reported@example.com",
        snapshot_tier: null,
        snapshot_role: null,
      }),
    ]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Self Reported Name")).toBeDefined();
    expect(screen.getByText("reported@example.com")).toBeDefined();
    expect(screen.getByText("Anonymous", { selector: "span" })).toBeDefined();
    expect(screen.queryByText(/Submitter tier:/)).toBeNull();
  });

  it("shows authenticated names with email fallback and never raw user ids", () => {
    mockQuery([
      outcome(),
      outcome({
        user_id: "fallback-raw-id",
        submitter_name: null,
        submitter_email: "fallback@example.com",
      }),
    ]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("fallback@example.com")).toBeDefined();
    expect(screen.queryByText("user-raw-id")).toBeNull();
    expect(screen.queryByText("fallback-raw-id")).toBeNull();
  });

  it("labels sweep decisions without exposing the sentinel", () => {
    mockQuery([
      outcome({ decided_by: "system:auto-accept", decided_by_name: null }),
    ]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Auto-accepted")).toBeDefined();
    expect(screen.queryByText("system:auto-accept")).toBeNull();
  });

  it("hides load more when every outcome is loaded", () => {
    mockQuery([outcome()], 1);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});

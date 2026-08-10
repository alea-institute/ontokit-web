import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
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

interface MockQueryOptions {
  total?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  data?: unknown;
  fetchNextPage?: ReturnType<typeof vi.fn>;
}

function mockQuery(items: SuggestionOutcomeItem[], options: MockQueryOptions = {}) {
  mockedUseSuggestionOutcomes.mockReturnValue({
    items,
    total: options.total ?? items.length,
    next_cursor: options.hasNextPage ? "next" : null,
    hasNextPage: options.hasNextPage ?? false,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
    isFetchingNextPage: options.isFetchingNextPage ?? false,
    data: "data" in options ? options.data : {},
    fetchNextPage: options.fetchNextPage ?? vi.fn(),
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
      outcome({
        user_id: null,
        is_anonymous: true,
        submitter_name: "Historical Anonymous",
        snapshot_tier: null,
        snapshot_captured_at: null,
      }),
    ]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    const anonymousRow = screen.getByText("Anonymous Author").closest("li")!;
    const preFeatureRow = screen.getByText("Legacy User").closest("li")!;
    const captureFailedRow = screen.getByText("Failed Capture").closest("li")!;
    const historicalAnonymousRow = screen.getByText("Historical Anonymous").closest("li")!;

    expect(within(anonymousRow).getByText("Anonymous", { selector: "span" })).toBeDefined();
    expect(
      within(preFeatureRow).getByTitle("Recorded before audit snapshots were captured"),
    ).toBeDefined();
    expect(within(captureFailedRow).getByText("Capture failed")).toBeDefined();
    expect(
      within(historicalAnonymousRow).getByTitle(
        "Recorded before audit snapshots were captured",
      ),
    ).toBeDefined();
    expect(within(historicalAnonymousRow).queryByText("Anonymous")).toBeNull();
  });

  it("renders the forward-only empty state", () => {
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByRole("heading", { name: "No decided outcomes yet" })).toBeDefined();
    expect(screen.getByText(/audit trail records from today forward/)).toBeDefined();
  });

  it("renders nothing for non-managers and threads the access gate to the hook", () => {
    mockQuery([outcome()]);
    const { container } = renderWithQueryClient(
      <AuditLogSection projectId="p1" accessToken="tok" canManage={false} />,
    );
    expect(container.innerHTML).toBe("");
    expect(mockedUseSuggestionOutcomes).toHaveBeenCalledWith("p1", "tok", false);
  });

  it("threads manager access to the hook and renders rows", () => {
    mockQuery([outcome()]);
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(mockedUseSuggestionOutcomes).toHaveBeenCalledWith("p1", "tok", true);
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

  it("shows load more from hasNextPage even when items length equals total", () => {
    mockQuery([outcome()], { total: 1, hasNextPage: true });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
  });

  it("hides load more when hasNextPage is false even if items length is below total", () => {
    mockQuery([outcome()], { total: 2, hasNextPage: false });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("fetches the next page once and disables the button while fetching", () => {
    const fetchNextPage = vi.fn();
    mockQuery([outcome()], { hasNextPage: true, fetchNextPage });
    const { rerender } = renderWithQueryClient(
      <AuditLogSection projectId="p1" accessToken="tok" canManage />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    mockQuery([outcome()], { hasNextPage: true, isFetchingNextPage: true, fetchNextPage });
    rerender(<AuditLogSection projectId="p1" accessToken="tok" canManage />);
    expect((screen.getByRole("button", { name: "Loading…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("renders loading while the query has no data", () => {
    mockQuery([], { isLoading: true, data: undefined });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Loading suggestion outcome audit trail…")).toBeDefined();
    expect(screen.queryByText("No decided outcomes yet")).toBeNull();
  });

  it("renders loading instead of empty state for a disabled query with no data", () => {
    mockQuery([], { data: undefined });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Loading suggestion outcome audit trail…")).toBeDefined();
    expect(screen.queryByText("No decided outcomes yet")).toBeNull();
  });

  it("renders the full error card when no rows have loaded", () => {
    mockQuery([], { isError: true });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Couldn't load the suggestion outcome audit trail.")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Suggestion Outcome Audit" })).toBeNull();
  });

  it("keeps loaded rows mounted and retries an inline pagination error", () => {
    const fetchNextPage = vi.fn();
    mockQuery([outcome()], { isError: true, fetchNextPage });
    renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);

    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("Couldn't load more")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("formats recent timestamps and falls back to a locale date after seven days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T16:00:00Z"));
    const oldDate = new Date("2026-08-01T16:00:00Z");
    mockQuery([
      outcome({ user_id: "30s", submitter_name: "Thirty Seconds", created_at: "2026-08-10T15:59:30Z" }),
      outcome({ user_id: "5m", submitter_name: "Five Minutes", created_at: "2026-08-10T15:55:00Z" }),
      outcome({ user_id: "3h", submitter_name: "Three Hours", created_at: "2026-08-10T13:00:00Z" }),
      outcome({ user_id: "2d", submitter_name: "Two Days", created_at: "2026-08-08T16:00:00Z" }),
      outcome({ user_id: "old", submitter_name: "Old Date", created_at: oldDate.toISOString() }),
    ]);

    try {
      renderWithQueryClient(<AuditLogSection projectId="p1" accessToken="tok" canManage />);
      expect(screen.getByText("just now")).toBeDefined();
      expect(screen.getByText("5m ago")).toBeDefined();
      expect(screen.getByText("3h ago")).toBeDefined();
      expect(screen.getByText("2d ago")).toBeDefined();
      expect(screen.getByText(oldDate.toLocaleDateString())).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

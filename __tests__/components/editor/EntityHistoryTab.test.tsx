import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/hooks/useEntityHistory", () => ({
  useEntityHistory: vi.fn(),
}));

import { EntityHistoryTab } from "@/components/editor/EntityHistoryTab";
import { useEntityHistory } from "@/lib/hooks/useEntityHistory";

const mockUseEntityHistory = vi.mocked(useEntityHistory);

describe("EntityHistoryTab", () => {
  it("returns null when entityIri is null", () => {
    mockUseEntityHistory.mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useEntityHistory>);
    const { container } = render(
      <EntityHistoryTab projectId="p1" entityIri={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when not loading and no events", () => {
    mockUseEntityHistory.mockReturnValue({
      data: { events: [], total: 0 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    const { container } = render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows loading state", () => {
    mockUseEntityHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    expect(screen.getByText("History (...)")).toBeDefined();
  });

  it("shows error message", () => {
    mockUseEntityHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    expect(screen.getByText("Failed to load history")).toBeDefined();
  });

  it("shows total count and expands events on click", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e1",
            event_type: "create",
            user_name: "Alice",
            changed_fields: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    expect(screen.getByText("History (1)")).toBeDefined();
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("created")).toBeDefined();
  });

  it("displays changed fields when present", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e2",
            event_type: "update",
            user_name: "Bob",
            changed_fields: ["label", "comment"],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("(label, comment)")).toBeDefined();
  });

  it("shows 'just now' for events less than 1 minute old", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e3",
            event_type: "create",
            user_name: "Eve",
            changed_fields: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("just now")).toBeDefined();
  });

  it("shows minutes ago for events within the last hour", async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e4",
            event_type: "update",
            user_name: "Carol",
            changed_fields: [],
            created_at: thirtyMinAgo,
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("30m ago")).toBeDefined();
  });

  it("shows hours ago for events within the last day", async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e5",
            event_type: "rename",
            user_name: "Dan",
            changed_fields: [],
            created_at: fiveHoursAgo,
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("5h ago")).toBeDefined();
  });

  it("shows days ago for events within the last month", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e6",
            event_type: "reparent",
            user_name: "Frank",
            changed_fields: [],
            created_at: tenDaysAgo,
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("10d ago")).toBeDefined();
  });

  it("shows locale date for events older than 30 days", async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e7",
            event_type: "deprecate",
            user_name: "Grace",
            changed_fields: [],
            created_at: ninetyDaysAgo,
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    // Should show a locale date string (e.g., "1/8/2026" or "8.1.2026" etc.)
    const date = new Date(ninetyDaysAgo);
    expect(screen.getByText(date.toLocaleDateString())).toBeDefined();
  });

  it("shows 'Unknown' when user_name is missing", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e8",
            event_type: "update",
            user_name: undefined,
            changed_fields: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("Unknown")).toBeDefined();
  });

  it("collapses events when clicking toggle again", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e9",
            event_type: "create",
            user_name: "Hank",
            changed_fields: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    // Expand
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.getByText("Hank")).toBeDefined();
    // Collapse
    await userEvent.click(screen.getByText("History (1)"));
    expect(screen.queryByText("Hank")).toBeNull();
  });

  it("uses fallback icon for unknown event types", async () => {
    mockUseEntityHistory.mockReturnValue({
      data: {
        events: [
          {
            id: "e10",
            event_type: "unknown_type",
            user_name: "Ivy",
            changed_fields: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEntityHistory>);
    render(
      <EntityHistoryTab projectId="p1" entityIri="http://example.org/A" />
    );
    await userEvent.click(screen.getByText("History (1)"));
    // Falls back to event_type string as label
    expect(screen.getByText("unknown_type")).toBeDefined();
  });
});

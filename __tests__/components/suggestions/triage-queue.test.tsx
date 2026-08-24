/**
 * U14 — triage queue UI and admin trust controls.
 *
 * The review page is exercised end to end (with its data layer mocked)
 * because the behaviours that matter here are interactions between the
 * filter, the selection, and a partial-success bulk response — none of which
 * survive being tested a component at a time.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  nextNavigationMock,
  nextLinkMock,
} from "@/__tests__/helpers/mockNextNavigation";
import type { SuggestionSessionSummary } from "@/lib/api/suggestions";
import type { MemberTrust } from "@/lib/api/trust";

vi.mock("next/navigation", () => nextNavigationMock({ params: { id: "proj-1" } }));
vi.mock("next/link", () => nextLinkMock);

const { mockedUseSession } = vi.hoisted(() => ({ mockedUseSession: vi.fn() }));
vi.mock("next-auth/react", () => ({
  useSession: mockedUseSession,
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("@/lib/hooks/useProject", async () => {
  const actual = await vi.importActual<typeof import("@/lib/hooks/useProject")>(
    "@/lib/hooks/useProject",
  );
  return {
    ...actual,
    useProject: vi.fn(),
  };
});

vi.mock("@/lib/hooks/useProjectHomeHref", () => ({
  useProjectHomeHref: () => "/projects/proj-1",
}));

vi.mock("@/lib/api/suggestions", () => ({
  suggestionsApi: {
    listPending: vi.fn(),
    bulkReview: vi.fn(),
    dismiss: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    requestChanges: vi.fn(),
  },
}));

vi.mock("@/lib/api/pullRequests", () => ({
  pullRequestsApi: { getDiff: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/lib/api/trust", () => ({
  trustApi: { setMemberTrust: vi.fn() },
}));

import { useProject } from "@/lib/hooks/useProject";
import { suggestionsApi } from "@/lib/api/suggestions";
import { trustApi } from "@/lib/api/trust";
import SuggestionReviewPage from "@/app/projects/[id]/suggestions/review/page";
import { MemberTrustControl } from "@/components/projects/MemberTrustControl";

const mockedUseProject = useProject as unknown as ReturnType<typeof vi.fn>;
const mockedListPending = suggestionsApi.listPending as unknown as ReturnType<typeof vi.fn>;
const mockedBulkReview = suggestionsApi.bulkReview as unknown as ReturnType<typeof vi.fn>;
const mockedApprove = suggestionsApi.approve as unknown as ReturnType<typeof vi.fn>;
const mockedSetMemberTrust = trustApi.setMemberTrust as unknown as ReturnType<typeof vi.fn>;

function summary(overrides: Partial<SuggestionSessionSummary> = {}): SuggestionSessionSummary {
  return {
    session_id: "s1",
    branch: "suggest/s1",
    changes_count: 1,
    last_activity: new Date().toISOString(),
    entities_modified: [],
    status: "submitted",
    submitter: { id: "u1", name: "Ada" },
    submitter_tier: "untrusted",
    ...overrides,
  };
}

const TRIAGE_ROWS = [
  summary({ session_id: "s1", submitter: { id: "u1", name: "Ada" }, submitter_tier: "anonymous" }),
  summary({ session_id: "s2", submitter: { id: "u2", name: "Bea" }, submitter_tier: "untrusted" }),
  summary({ session_id: "s3", submitter: { id: "u3", name: "Cyd" }, submitter_tier: "untrusted" }),
];

const TRUSTED_ROWS = [
  summary({ session_id: "t1", submitter: { id: "u9", name: "Dov" }, submitter_tier: "trusted" }),
];

/** The tier badges say "Trusted" too, so queue buttons are looked up in the filter group. */
function queueButton(name: RegExp) {
  return within(screen.getByRole("group", { name: /Filter suggestions/ })).getByRole("button", {
    name,
  });
}

function reviewerProject(role = "admin") {
  return {
    project: { id: "proj-1", name: "Canon", user_role: role, is_public: true },
    isLoading: false,
    error: null,
    errorKind: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSession.mockReturnValue({
    data: {
      user: { name: "Test User", email: "test@example.com" },
      accessToken: "test-token",
      expires: "2099-01-01T00:00:00.000Z",
    },
    status: "authenticated",
  });
  mockedUseProject.mockReturnValue(reviewerProject());
  mockedListPending.mockImplementation((_id: string, _token: string, queue?: string) =>
    Promise.resolve({
      items: queue === "review" ? TRUSTED_ROWS : queue === "triage" ? TRIAGE_ROWS : [...TRIAGE_ROWS, ...TRUSTED_ROWS],
    }),
  );
});

describe("triage queue", () => {
  it("switching to Triage requests queue=triage and renders only those items", async () => {
    const user = userEvent.setup();
    render(<SuggestionReviewPage />);

    // Default listing is unfiltered — backward compatible with the old client.
    await waitFor(() => expect(mockedListPending).toHaveBeenCalled());
    expect(mockedListPending.mock.calls[0][2]).toBeUndefined();
    expect(await screen.findByText("Dov")).toBeDefined();

    await user.click(queueButton(/Triage/));

    await waitFor(() =>
      expect(mockedListPending).toHaveBeenCalledWith("proj-1", "test-token", "triage"),
    );
    await waitFor(() => expect(screen.queryByText("Dov")).toBeNull());
    expect(screen.getByText("Ada")).toBeDefined();
  });

  it("the Trusted queue asks for queue=review", async () => {
    const user = userEvent.setup();
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    await user.click(queueButton(/Trusted/));

    await waitFor(() =>
      expect(mockedListPending).toHaveBeenCalledWith("proj-1", "test-token", "review"),
    );
    expect(await screen.findByText("Dov")).toBeDefined();
  });

  it("ignores an older session request that resolves after the latest request", async () => {
    let resolveFirst: (value: { items: SuggestionSessionSummary[] }) => void = () => {};
    mockedListPending
      .mockImplementationOnce(
        () =>
          new Promise<{ items: SuggestionSessionSummary[] }>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: TRUSTED_ROWS });

    const { rerender } = render(<SuggestionReviewPage />);
    expect(mockedListPending).toHaveBeenCalledWith("proj-1", "test-token", undefined);

    mockedUseSession.mockReturnValue({
      data: {
        user: { name: "Other Reviewer", email: "other@example.com" },
        accessToken: "new-token",
        expires: "2099-01-01T00:00:00.000Z",
      },
      status: "authenticated",
    });
    rerender(<SuggestionReviewPage />);

    expect(await screen.findByText("Dov")).toBeDefined();
    expect(mockedListPending).toHaveBeenCalledWith("proj-1", "new-token", undefined);

    await act(async () => {
      resolveFirst({ items: TRIAGE_ROWS });
    });

    expect(screen.getByText("Dov")).toBeDefined();
    expect(screen.queryByText("Ada")).toBeNull();
  });

  it("renders a tier badge for anonymous, new-contributor and trusted rows", async () => {
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    expect(screen.getAllByText("Anonymous").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New contributor").length).toBe(2);
    expect(screen.getAllByText("Trusted").length).toBeGreaterThan(0);
  });

  it("selecting three items and dismissing issues one bulk call with three ids", async () => {
    const user = userEvent.setup();
    mockedBulkReview.mockResolvedValue({ action: "dismiss", succeeded: ["s1", "s2", "s3"], failed: [] });
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Ada/ }));
    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Bea/ }));
    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Cyd/ }));

    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(within(bar).getByText("3 selected")).toBeDefined();

    await user.click(within(bar).getByRole("button", { name: /Dismiss/ }));

    await waitFor(() => expect(mockedBulkReview).toHaveBeenCalledTimes(1));
    expect(mockedBulkReview).toHaveBeenCalledWith(
      "proj-1",
      { session_ids: ["s1", "s2", "s3"], action: "dismiss" },
      "test-token",
    );
  });

  it("a partial-success response renders the failed items with their reasons and keeps them selected", async () => {
    const user = userEvent.setup();
    mockedBulkReview.mockResolvedValue({
      action: "accept",
      succeeded: ["s1"],
      failed: [{ session_id: "s2", reason: "Session already merged" }],
    });
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Ada/ }));
    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Bea/ }));
    await user.click(
      within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", {
        name: /Accept/,
      }),
    );

    // The reason is shown per item, not folded into one toast.
    expect(await screen.findByText(/Not processed: Session already merged/)).toBeDefined();

    // The failed row stays selected so a retry is one click.
    await waitFor(() =>
      expect(
        (screen.getByRole("checkbox", { name: /Select suggestion from Bea/ }) as HTMLInputElement)
          .checked,
      ).toBe(true),
    );
    expect(
      (screen.getByRole("checkbox", { name: /Select suggestion from Ada/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(screen.getByText("1 selected")).toBeDefined();
  });

  it("shows no bulk action bar until something is selected", async () => {
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
  });

  it("a non-reviewer never sees the queue or the bulk action bar", async () => {
    mockedUseProject.mockReturnValue(reviewerProject("suggester"));
    render(<SuggestionReviewPage />);

    expect(await screen.findByText("Access Restricted")).toBeDefined();
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    expect(screen.queryByRole("group", { name: /Filter suggestions/ })).toBeNull();
  });

  it("switching queues clears a selection that no longer applies", async () => {
    const user = userEvent.setup();
    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Ada/ }));
    expect(screen.getByText("1 selected")).toBeDefined();

    await user.click(queueButton(/Trusted/));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull());
  });

  it("removes a selected terminal suggestion after a single approve", async () => {
    const user = userEvent.setup();
    mockedApprove.mockResolvedValue(undefined);
    mockedListPending
      .mockResolvedValueOnce({ items: TRIAGE_ROWS })
      .mockResolvedValue({ items: TRIAGE_ROWS.filter((row) => row.session_id !== "s1") });

    render(<SuggestionReviewPage />);
    await screen.findByText("Ada");

    await user.click(screen.getByRole("checkbox", { name: /Select suggestion from Ada/ }));
    await user.click(screen.getByRole("button", { name: /Ada/ }));
    await user.click(screen.getByRole("button", { name: /^Approve$/ }));

    await waitFor(() => expect(mockedApprove).toHaveBeenCalledWith("proj-1", "s1", "test-token"));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull());
    await waitFor(() => expect(screen.queryByText("Ada")).toBeNull());
  });

  it("caps select all at 100 and leaves the bulk actions usable", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 101 }, (_, index) =>
      summary({
        session_id: `large-${index + 1}`,
        submitter: { id: `user-${index + 1}`, name: `Reviewer ${index + 1}` },
      }),
    );
    mockedListPending.mockResolvedValue({ items: rows });
    mockedBulkReview.mockResolvedValue({
      action: "dismiss",
      succeeded: rows.slice(0, 100).map((row) => row.session_id),
      failed: [],
    });

    render(<SuggestionReviewPage />);
    await screen.findByText("Reviewer 1");

    await user.click(
      screen.getByRole("checkbox", { name: /^Select suggestion from Reviewer 1$/ }),
    );
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    await user.click(within(bar).getByRole("checkbox", { name: "Select all 100" }));

    expect(within(bar).getByText("100 selected")).toBeDefined();
    expect(
      (within(bar).getByRole("button", { name: /Dismiss/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      screen.getByText(/Bulk actions are limited to 100 suggestions at a time/),
    ).toBeDefined();
    expect(
      (screen.getByRole("checkbox", {
        name: /^Select suggestion from Reviewer 101$/,
      }) as HTMLInputElement).disabled,
    ).toBe(true);

    await user.click(within(bar).getByRole("button", { name: /Dismiss/ }));

    await waitFor(() => expect(mockedBulkReview).toHaveBeenCalledTimes(1));
    const payload = mockedBulkReview.mock.calls[0][1];
    expect(payload.session_ids).toHaveLength(100);
    expect(payload.session_ids).not.toContain("large-101");
  });
});

describe("MemberTrustControl", () => {
  function memberTrust(overrides: Partial<MemberTrust> = {}): MemberTrust {
    return {
      user_id: "u1",
      role: "suggester",
      tier: "untrusted",
      is_trusted: false,
      trust_override: "none",
      accepted_count: 3,
      ...overrides,
    };
  }

  it("calls the trust endpoint and optimistically updates the member row", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    let resolveCall: (value: MemberTrust) => void = () => {};
    mockedSetMemberTrust.mockImplementation(
      () => new Promise<MemberTrust>((resolve) => { resolveCall = resolve; }),
    );

    render(
      <MemberTrustControl
        projectId="proj-1"
        userId="u1"
        trust={memberTrust()}
        token="test-token"
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Trust status for this member/ }));
    await user.click(screen.getByRole("menuitem", { name: /Grant trusted/ }));

    // Optimistic: the badge moves before the request settles.
    expect(await screen.findByText("Trusted (granted)")).toBeDefined();
    expect(mockedSetMemberTrust).toHaveBeenCalledWith("proj-1", "u1", "granted", "test-token");

    resolveCall(memberTrust({ trust_override: "granted", is_trusted: true, tier: "trusted" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("rolls the row back and shows the error when the grant fails", async () => {
    const user = userEvent.setup();
    mockedSetMemberTrust.mockRejectedValue(new Error("Owner or admin access required"));

    render(
      <MemberTrustControl
        projectId="proj-1"
        userId="u1"
        trust={memberTrust()}
        token="test-token"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Trust status for this member/ }));
    await user.click(screen.getByRole("menuitem", { name: /Revoke trust/ }));

    expect(await screen.findByRole("alert")).toBeDefined();
    await waitFor(() => expect(screen.getByText("Earning trust")).toBeDefined());
  });

  it("offers an explicit hand-back to the ladder, and marks the current state", async () => {
    const user = userEvent.setup();
    render(
      <MemberTrustControl
        projectId="proj-1"
        userId="u1"
        trust={memberTrust({ trust_override: "refused" })}
        token="test-token"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Trust status for this member/ }));

    const current = screen.getByRole("menuitem", { name: /Refuse trust \(current\)/ });
    expect((current as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("menuitem", { name: /Leave it to the ladder/ })).toBeDefined();
  });

  it("renders nothing while the trust row is still unknown", () => {
    const { container } = render(
      <MemberTrustControl projectId="proj-1" userId="u1" trust={null} token="t" />,
    );
    expect(container.innerHTML).toBe("");
  });
});

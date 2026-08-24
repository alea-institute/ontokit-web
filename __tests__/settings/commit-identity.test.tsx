/**
 * U12 — "How your contributions are credited".
 *
 * The five plan scenarios run against the real settings page with only its
 * data layer mocked, because what U12 promises is a page-level property: a
 * contributor never sees a GitHub credential prompt, and the credit card is
 * driven end to end by the commit-identity endpoint. The extracted
 * CommitIdentityCard is then exercised directly for the states the page
 * cannot easily reach (mid-save, no opt-in address on file).
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// editorModeStore touches matchMedia at module load.
vi.hoisted(() => {
  (globalThis as Record<string, unknown>).matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

import { nextLinkMock, nextAuthMock } from "@/__tests__/helpers/mockNextNavigation";

vi.mock("next/link", () => nextLinkMock);
vi.mock("next-auth/react", () => nextAuthMock());

vi.mock("@/components/layout/header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("@/lib/api/userSettings", () => ({
  userSettingsApi: {
    getCommitIdentity: vi.fn(),
    updateCommitIdentity: vi.fn(),
  },
}));

import { userSettingsApi, type CommitIdentity } from "@/lib/api/userSettings";
import { CommitIdentityCard } from "@/components/settings/CommitIdentityCard";
import UserSettingsPage from "@/app/settings/page";

const mockedGet = userSettingsApi.getCommitIdentity as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = userSettingsApi.updateCommitIdentity as unknown as ReturnType<
  typeof vi.fn
>;

const ALIAS = "1234567+contributor@users.noreply.github.com";

function identity(overrides: Partial<CommitIdentity> = {}): CommitIdentity {
  return {
    display_name: "Ada Lovelace",
    noreply_alias: ALIAS,
    commit_email: null,
    commit_email_verified: false,
    use_verified_email: false,
    effective_email: ALIAS,
    ...overrides,
  };
}

describe("U12 — commit identity settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockResolvedValue(identity());
  });

  // Scenario 1
  it("renders the settings page with no GitHub-token input present", async () => {
    render(<UserSettingsPage />);

    await screen.findByText("How your contributions are credited");

    expect(screen.queryByText(/personal access token/i)).toBeNull();
    expect(screen.queryByLabelText(/token/i)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    // No credential entry of any kind anywhere on the page.
    expect(document.querySelectorAll('input[type="text"]')).toHaveLength(0);
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /connect github|save token/i })).toBeNull();
  });

  // Scenario 2
  it("shows the alias returned by the API as the publicly shown address", async () => {
    render(<UserSettingsPage />);

    const address = await screen.findByTestId("effective-email");
    expect(address.textContent).toBe(ALIAS);
    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(mockedGet).toHaveBeenCalledWith("test-token");
  });

  // Scenario 3
  it("calls the update endpoint with the expected payload when the opt-in is toggled", async () => {
    const verified = identity({
      commit_email: "ada@example.com",
      commit_email_verified: true,
      use_verified_email: false,
    });
    mockedGet.mockResolvedValue(verified);
    mockedUpdate.mockResolvedValue({
      ...verified,
      use_verified_email: true,
      effective_email: "ada@example.com",
    });

    render(<UserSettingsPage />);

    const checkbox = (await screen.findByRole("checkbox")) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await userEvent.click(checkbox);

    expect(mockedUpdate).toHaveBeenCalledWith(
      { use_verified_email: true },
      "test-token",
    );
    await waitFor(() => {
      expect(screen.getByTestId("effective-email").textContent).toBe("ada@example.com");
    });
    expect(screen.getByText("Credit settings updated")).not.toBeNull();
  });

  // Scenario 4
  it("shows a verification-pending state that does not claim the address will be used", async () => {
    mockedGet.mockResolvedValue(
      identity({
        commit_email: "ada@example.com",
        commit_email_verified: false,
        use_verified_email: false,
      }),
    );

    render(<UserSettingsPage />);

    const pending = await screen.findByText(/not verified yet/i);
    expect(pending.textContent).toContain("it will not be used");
    expect(pending.textContent).toContain("stays in place");
    // The opt-in is not offered for an unverified address.
    expect(screen.queryByRole("checkbox")).toBeNull();
    // The stand-in alias is still what is shown publicly.
    expect(screen.getByTestId("effective-email").textContent).toBe(ALIAS);
  });

  // Scenario 5
  it("renders an error state rather than a blank card when the API fails", async () => {
    mockedGet.mockRejectedValue(new Error("boom"));

    render(<UserSettingsPage />);

    expect(
      await screen.findByText("Couldn't load your credit settings. Try again in a moment."),
    ).not.toBeNull();
    // The card is still there, explaining itself.
    expect(screen.getByText("How your contributions are credited")).not.toBeNull();
    expect(screen.getByText(/Credit settings are unavailable right now/)).not.toBeNull();
    expect(screen.queryByTestId("effective-email")).toBeNull();
  });

  it("surfaces an update failure without silently flipping the opt-in", async () => {
    const verified = identity({
      commit_email: "ada@example.com",
      commit_email_verified: true,
      use_verified_email: false,
    });
    mockedGet.mockResolvedValue(verified);
    mockedUpdate.mockRejectedValue(new Error("Couldn't reach the server"));

    render(<UserSettingsPage />);

    const checkbox = (await screen.findByRole("checkbox")) as HTMLInputElement;
    await userEvent.click(checkbox);

    expect(await screen.findByText("Couldn't reach the server")).not.toBeNull();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId("effective-email").textContent).toBe(ALIAS);
  });
});

describe("CommitIdentityCard", () => {
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says there is nothing to do when no opt-in address is on file", () => {
    render(
      <CommitIdentityCard identity={identity()} isSaving={false} onToggleVerifiedEmail={noop} />,
    );

    expect(screen.getByText(/Nothing to do here/)).not.toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("falls back to a generic credit when the display name is missing", () => {
    render(
      <CommitIdentityCard
        identity={identity({ display_name: null })}
        isSaving={false}
        onToggleVerifiedEmail={noop}
      />,
    );

    expect(screen.getByText("Contributor")).not.toBeNull();
  });

  it("disables the opt-in while a save is in flight", async () => {
    render(
      <CommitIdentityCard
        identity={identity({
          commit_email: "ada@example.com",
          commit_email_verified: true,
          use_verified_email: false,
        })}
        isSaving
        onToggleVerifiedEmail={noop}
      />,
    );

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    await userEvent.click(checkbox);
    expect(noop).not.toHaveBeenCalled();
  });

  it("renders the unavailable state as an alert when identity is null", () => {
    render(<CommitIdentityCard identity={null} isSaving={false} onToggleVerifiedEmail={noop} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Credit settings are unavailable right now");
    expect(screen.queryByTestId("effective-email")).toBeNull();
  });
});

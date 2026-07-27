/**
 * U13 — reviewer-only PR Party settings: PAT intake, credential health,
 * rotation, removal, ntfy topic and merge placement (R11/R12, KTD13 UI half).
 *
 * Two properties carry the unit. First, a token that can merge and approve as
 * the reviewer must never be asked for without the disclosure attached, must
 * never be persisted client-side, and must survive a rejected save — a
 * wrong-login 400 that also wipes the field costs the reviewer the whole paste.
 * Second, the page is reviewer-gated on exactly the capability the queue uses;
 * `/settings`, the contributor surface, stays token-free and untouched.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { nextLinkMock } from "@/__tests__/helpers/mockNextNavigation";
import { ApiError } from "@/lib/api/client";
import type { PRPartyCredentialHealth } from "@/lib/api/prParty";

const { signInSpy } = vi.hoisted(() => ({ signInSpy: vi.fn() }));

let mockStatus: "loading" | "authenticated" | "unauthenticated" = "authenticated";

vi.mock("next/link", () => nextLinkMock);

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data:
      mockStatus === "authenticated"
        ? { user: { email: "reviewer@example.com" }, accessToken: "token" }
        : null,
    status: mockStatus,
  }),
  signIn: signInSpy,
  signOut: vi.fn(),
}));

vi.mock("@/components/layout/header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("@/lib/hooks/usePRPartyCapabilities", () => ({
  usePRPartyCapabilities: vi.fn(),
}));

vi.mock("@/lib/hooks/usePRPartyQueue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hooks/usePRPartyQueue")>();
  return { ...actual, usePRPartySettings: vi.fn() };
});

vi.mock("@/lib/api/prParty", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/prParty")>();
  return {
    ...actual,
    prPartyApi: {
      setCredential: vi.fn(),
      revokeCredential: vi.fn(),
      updateSettings: vi.fn(),
    },
  };
});

import { usePRPartyCapabilities } from "@/lib/hooks/usePRPartyCapabilities";
import { usePRPartySettings } from "@/lib/hooks/usePRPartyQueue";
import { prPartyApi } from "@/lib/api/prParty";
import { CredentialCard, PAT_FIELD_NAME } from "@/components/pr-party/CredentialCard";
import PRPartySettingsPage, {
  NTFY_TOPIC_PATTERN,
  hasLapsed,
} from "@/app/pr-party/settings/page";

const mockedCapabilities = usePRPartyCapabilities as unknown as ReturnType<typeof vi.fn>;
const mockedSettings = usePRPartySettings as unknown as ReturnType<typeof vi.fn>;
const setCredential = prPartyApi.setCredential as unknown as ReturnType<typeof vi.fn>;
const revokeCredential = prPartyApi.revokeCredential as unknown as ReturnType<typeof vi.fn>;
const updateSettings = prPartyApi.updateSettings as unknown as ReturnType<typeof vi.fn>;

// --- Fixtures ---

function makeCredential(
  overrides: Partial<PRPartyCredentialHealth> = {},
): PRPartyCredentialHealth {
  return {
    expires_at: "2027-01-01T00:00:00Z",
    last_validated_at: "2026-07-26T09:00:00Z",
    last_error: null,
    expired: false,
    expires_soon: false,
    ...overrides,
  };
}

/** A PR Party error body, shaped the way the API client hands it back. */
function apiError(status: number, message: string) {
  return new ApiError(status, "error", JSON.stringify({ detail: { message } }));
}

function text(element: HTMLElement): string {
  return element.textContent ?? "";
}

function value(element: HTMLElement): string {
  return (element as HTMLInputElement).value;
}

function setCapabilities({
  isReviewer = true,
  credential = null,
  generationToken = null,
  isLoading = false,
}: {
  isReviewer?: boolean;
  credential?: PRPartyCredentialHealth | null;
  generationToken?: { expires_at: string | null; last_error: string | null } | null;
  isLoading?: boolean;
} = {}) {
  mockedCapabilities.mockReturnValue({
    capabilities: null,
    isReviewer,
    degraded: false,
    githubLogin: "reviewer",
    credential,
    credentialExpired: credential?.expired === true,
    credentialExpiringSoon: credential?.expires_soon === true,
    generationToken,
    isLoading,
    isError: false,
    refetch: vi.fn(),
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PRPartySettingsPage />
    </QueryClientProvider>,
  );
}

describe("PR Party settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus = "authenticated";
    setCapabilities();
    mockedSettings.mockReturnValue({
      settings: { merge_default: "dashboard", ntfy_topic: "quiet-owl" },
      isLoading: false,
      isError: false,
      error: null,
    });
    setCredential.mockResolvedValue({});
    revokeCredential.mockResolvedValue({
      revoked_locally: true,
      revoke_url: "https://github.com/settings/tokens",
    });
    updateSettings.mockResolvedValue({ merge_default: "manual", ntfy_topic: "quiet-owl" });
  });

  it("shows a reviewer the intake form", () => {
    renderPage();
    expect(screen.getByLabelText(/GitHub personal access token/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /connect token/i })).toBeTruthy();
  });

  it("tells a non-reviewer nothing and offers no field", () => {
    setCapabilities({ isReviewer: false });
    renderPage();
    expect(screen.getByText(/limited to designated reviewers/i)).toBeTruthy();
    expect(screen.queryByLabelText(/personal access token/i)).toBeNull();
  });

  it("asks an unauthenticated visitor to sign in, and comes back here", async () => {
    mockStatus = "unauthenticated";
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signInSpy).toHaveBeenCalledWith(
      "zitadel",
      expect.objectContaining({ callbackUrl: "/pr-party/settings" }),
    );
    expect(screen.queryByLabelText(/personal access token/i)).toBeNull();
  });

  it("surfaces a wrong-login 400 and keeps what was typed", async () => {
    setCredential.mockRejectedValue(
      apiError(400, "That token belongs to octocat, but you sign in as frjohn."),
    );
    renderPage();

    const field = screen.getByLabelText(/GitHub personal access token/i);
    await userEvent.type(field, "ghp_wrongowner");
    await userEvent.click(screen.getByRole("button", { name: /connect token/i }));

    await waitFor(() => {
      expect(text(screen.getByTestId("credential-save-error"))).toMatch(
        /belongs to octocat.*sign in as frjohn/i,
      );
    });
    // The paste survives the rejection — retyping a PAT is how people give up.
    expect(value(field)).toBe("ghp_wrongowner");
  });

  it("leaves a rotation intact when GitHub is unreachable", async () => {
    setCapabilities({ credential: makeCredential() });
    setCredential.mockRejectedValue(apiError(502, "GitHub could not be reached."));
    renderPage();

    const field = screen.getByLabelText(/replace your token/i);
    await userEvent.type(field, "ghp_rotated");
    await userEvent.click(screen.getByRole("button", { name: /replace token/i }));

    await waitFor(() => {
      expect(text(screen.getByTestId("credential-save-error"))).toMatch(
        /could not be reached/i,
      );
    });
    expect(value(field)).toBe("ghp_rotated");
    // Still the rotation form, not a fall back to first-time intake.
    expect(screen.getByRole("button", { name: /remove token/i })).toBeTruthy();
  });

  it("warns at T-30 without calling it broken", () => {
    setCapabilities({ credential: makeCredential({ expires_soon: true }) });
    renderPage();
    expect(text(screen.getByTestId("credential-banner-expiring"))).toMatch(/expires on/i);
    expect(screen.queryByTestId("credential-banner-expired")).toBeNull();
  });

  it("says an expired credential is expired, and that reviewing still works", () => {
    setCapabilities({ credential: makeCredential({ expired: true }) });
    renderPage();
    const banner = text(screen.getByTestId("credential-banner-expired"));
    expect(banner).toMatch(/expired/i);
    expect(banner).toMatch(/finished on GitHub by hand/i);
  });

  it("explains degraded mode rather than erroring when there is no credential", () => {
    renderPage();
    expect(text(screen.getByTestId("credential-degraded-explainer"))).toMatch(
      /supported way to work/i,
    );
    expect(screen.queryByTestId("credential-banner-expired")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("confirms before removing, then drops to degraded and shows the revoke link", async () => {
    setCapabilities({ credential: makeCredential() });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /remove token/i }));
    expect(revokeCredential).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole("button", { name: /remove it/i }));

    await waitFor(() => expect(revokeCredential).toHaveBeenCalledWith("token"));
    const success = await screen.findByTestId("pr-party-settings-success");
    expect(text(success)).toMatch(/forgotten your token/i);
    expect(
      screen.getByRole("link", { name: /finish revoking it on GitHub/i }).getAttribute("href"),
    ).toBe("https://github.com/settings/tokens");
  });

  it("refuses an unusable ntfy topic before it reaches the server", async () => {
    renderPage();
    const topic = screen.getByLabelText(/ntfy topic/i);
    await userEvent.clear(topic);
    await userEvent.type(topic, "not a topic!");
    await userEvent.click(screen.getByRole("button", { name: /save topic/i }));

    expect(screen.getByTestId("ntfy-topic-error")).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("saves a valid ntfy topic", async () => {
    renderPage();
    const topic = screen.getByLabelText(/ntfy topic/i);
    await userEvent.clear(topic);
    await userEvent.type(topic, "quiet-owl_42");
    await userEvent.click(screen.getByRole("button", { name: /save topic/i }));

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ ntfy_topic: "quiet-owl_42" }, "token"),
    );
  });

  it("tells the reviewer the topic is secret-like", () => {
    renderPage();
    expect(
      screen.getByText(/anyone who knows the topic can read your pings/i),
    ).toBeTruthy();
  });

  it("stores the merge placement when it changes", async () => {
    renderPage();
    const onGitHub = screen.getByRole("button", { name: "On GitHub" });
    expect(onGitHub.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Here" }).getAttribute("aria-pressed"),
    ).toBe("true");

    await userEvent.click(onGitHub);
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ merge_default: "manual" }, "token"),
    );
  });

  it("reports an expired shared generation token", () => {
    setCapabilities({
      // Mid-year so the rendered year is timezone-independent.
      generationToken: { expires_at: "2020-06-15T00:00:00Z", last_error: null },
    });
    renderPage();
    expect(text(screen.getByTestId("generation-token-expiry"))).toMatch(/2020/);
    expect(text(screen.getByTestId("generation-token-banner"))).toMatch(/expired/i);
  });

  it("shows generation-token expiry with no banner while it is healthy", () => {
    setCapabilities({
      generationToken: { expires_at: "2099-01-01T00:00:00Z", last_error: null },
    });
    renderPage();
    expect(screen.getByTestId("generation-token-expiry")).toBeTruthy();
    expect(screen.queryByTestId("generation-token-banner")).toBeNull();
  });
});

describe("CredentialCard", () => {
  const onSave = vi.fn();
  const onRequestRemove = vi.fn();

  function renderCard(props: Partial<React.ComponentProps<typeof CredentialCard>> = {}) {
    return render(
      <CredentialCard
        credential={null}
        githubLogin="reviewer"
        isSaving={false}
        isRemoving={false}
        saveError={null}
        onSave={onSave}
        onRequestRemove={onRequestRemove}
        {...props}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  it("discloses what the token does, where it lives, how to revoke, and that no is an answer", () => {
    renderCard();
    expect(
      screen.getByText(/post reviews, merge pull requests, and comment/i),
    ).toBeTruthy();
    expect(screen.getByText(/stored encrypted on OntoKit/i)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /your personal access tokens/i })
        .getAttribute("href"),
    ).toBe("https://github.com/settings/tokens");
    expect(screen.getByText(/never have to connect one/i)).toBeTruthy();
  });

  it("keeps the PAT field out of autofill and out of plain sight", () => {
    renderCard();
    const field = screen.getByLabelText(/GitHub personal access token/i);
    expect(field.getAttribute("type")).toBe("password");
    expect(field.getAttribute("autocomplete")).toBe("off");
    expect(field.getAttribute("name")).toBe(PAT_FIELD_NAME);
    // Not a name a password manager or a scraper reads as a credential field.
    expect(PAT_FIELD_NAME).not.toMatch(/password|token$|^github/i);
  });

  it("clears the field only once the save is confirmed", async () => {
    renderCard();
    const field = screen.getByLabelText(/GitHub personal access token/i);
    await userEvent.type(field, "ghp_good");
    await userEvent.click(screen.getByRole("button", { name: /connect token/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("ghp_good"));
    await waitFor(() => expect(value(field)).toBe(""));
  });

  it("cannot submit an empty token", () => {
    renderCard();
    const submit = screen.getByRole("button", { name: /connect token/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("asks the page to confirm rather than removing anything itself", async () => {
    renderCard({ credential: makeCredential() });
    await userEvent.click(screen.getByRole("button", { name: /remove token/i }));
    expect(onRequestRemove).toHaveBeenCalledTimes(1);
  });

  it("renders a rejected credential as an error the reviewer can act on", () => {
    renderCard({ credential: makeCredential({ last_error: "Bad credentials" }) });
    expect(text(screen.getByTestId("credential-banner-expired"))).toMatch(
      /Bad credentials/,
    );
  });
});

describe("hasLapsed", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");

  it("treats an absent or unparseable expiry as not lapsed", () => {
    // No expiry is a token that does not expire, not a token that has.
    expect(hasLapsed(null, now)).toBe(false);
    expect(hasLapsed("not a date", now)).toBe(false);
  });

  it("lapses at the boundary and not before it", () => {
    expect(hasLapsed("2026-07-26T12:00:00Z", now)).toBe(true);
    expect(hasLapsed("2026-07-26T12:00:01Z", now)).toBe(false);
    expect(hasLapsed("2026-07-26T11:59:59Z", now)).toBe(true);
  });
});

describe("NTFY_TOPIC_PATTERN", () => {
  it("accepts what ntfy accepts and nothing else", () => {
    expect(NTFY_TOPIC_PATTERN.test("quiet-owl_42")).toBe(true);
    expect(NTFY_TOPIC_PATTERN.test("a".repeat(64))).toBe(true);
    expect(NTFY_TOPIC_PATTERN.test("a".repeat(65))).toBe(false);
    expect(NTFY_TOPIC_PATTERN.test("has space")).toBe(false);
    expect(NTFY_TOPIC_PATTERN.test("path/traversal")).toBe(false);
    expect(NTFY_TOPIC_PATTERN.test("")).toBe(false);
  });
});

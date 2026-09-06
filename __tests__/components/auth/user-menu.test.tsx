import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSignIn = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockUseSession = vi.fn();
const mockClearAll = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock("@/lib/stores/byoKeyStore", () => ({
  useByoKeyStore: {
    getState: () => ({ clearAll: mockClearAll }),
  },
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

import { UserMenu } from "@/components/auth/user-menu";

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to a configured deployment (Zitadel present) so sign-in UI shows —
    // the case these tests exercise. Anonymous/hidden case tested separately below.
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
    // Reset location mock
    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "http://localhost:3000", href: "" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows loading skeleton when status is loading", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });
    const { container } = render(<UserMenu />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).not.toBeNull();
  });

  it("shows sign in button when not authenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<UserMenu />);
    expect(screen.getByText("Sign in")).toBeDefined();
  });

  it("calls signIn with zitadel when sign in is clicked", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<UserMenu />);
    await userEvent.click(screen.getByText("Sign in"));
    expect(mockSignIn).toHaveBeenCalledWith("zitadel");
  });

  it("renders nothing when unauthenticated and auth UI is hidden (disabled/anonymous mode)", () => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { container } = render(<UserMenu />);
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("shows user initial when authenticated without image", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-a", name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    expect(screen.getByText("A")).toBeDefined();
  });

  it("shows user image when available", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "Alice",
          email: "alice@test.com",
          image: "https://example.com/avatar.png",
        },
      },
      status: "authenticated",
    });
    render(<UserMenu />);
    const img = screen.getByAltText("Alice");
    expect(img).toBeDefined();
  });

  it("opens dropdown on avatar click and shows user info", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    await userEvent.click(screen.getByText("A"));
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("alice@test.com")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Sign out")).toBeDefined();
  });

  it("closes dropdown on outside click", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    await userEvent.click(screen.getByText("A"));
    expect(screen.getByText("Sign out")).toBeDefined();
    // Click outside
    await userEvent.click(document.body);
    expect(screen.queryByText("Sign out")).toBeNull();
  });

  it("clears all BYO secrets before ending the authenticated session", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    await userEvent.click(screen.getByText("A"));
    await userEvent.click(screen.getByText("Sign out"));
    expect(mockClearAll).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(mockClearAll.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it("navigates to the configured federated logout endpoint with an encoded redirect", async () => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_ISSUER", "https://auth.example.test");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CLIENT_ID", "client-123");
    vi.resetModules();
    const { UserMenu: ConfiguredUserMenu } = await import(
      "@/components/auth/user-menu"
    );
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });

    render(<ConfiguredUserMenu />);
    await userEvent.click(screen.getByText("A"));
    await userEvent.click(screen.getByText("Sign out"));

    expect(window.location.href).toBe(
      "https://auth.example.test/oidc/v1/end_session?client_id=client-123&post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000",
    );
  });

  it("fails loudly without an issuer and never redirects to localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_ISSUER", "");
    vi.resetModules();
    const { UserMenu: MisconfiguredUserMenu } = await import(
      "@/components/auth/user-menu"
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });

    render(<MisconfiguredUserMenu />);
    await userEvent.click(screen.getByText("A"));
    await userEvent.click(screen.getByText("Sign out"));

    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(window.location.href).toBe("");
    expect(window.location.href).not.toContain("localhost:8080");
    expect(consoleError).toHaveBeenCalledWith(
      "Cannot complete federated logout: NEXT_PUBLIC_ZITADEL_ISSUER is not configured",
    );
    consoleError.mockRestore();
  });

  it("shows U as initial when name is undefined", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: undefined, email: "test@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    expect(screen.getByText("U")).toBeDefined();
  });
});

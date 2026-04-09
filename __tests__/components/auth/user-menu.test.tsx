import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSignIn = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
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
    // Reset location mock
    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "http://localhost:3000", href: "" },
    });
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

  it("shows user initial when authenticated without image", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
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

  it("calls signOut with redirect:false on sign out click", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Alice", email: "alice@test.com", image: null } },
      status: "authenticated",
    });
    render(<UserMenu />);
    await userEvent.click(screen.getByText("A"));
    await userEvent.click(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
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

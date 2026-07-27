import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mockSignIn = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

import { SessionGuard } from "@/components/auth/SessionGuard";

describe("SessionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing (returns null)", () => {
    mockUseSession.mockReturnValue({ data: null });
    const { container } = render(<SessionGuard />);
    expect(container.innerHTML).toBe("");
  });

  it("does not call signIn when there is no error", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Test" }, error: undefined },
    });
    render(<SessionGuard />);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("calls signIn with zitadel and returns to the current page", () => {
    mockUseSession.mockReturnValue({
      data: { error: "RefreshAccessTokenError" },
    });
    render(<SessionGuard />);
    // Without a callbackUrl the re-auth dumps the user on the home page, losing
    // whatever they had open — a PR Party card, a half-typed question.
    expect(mockSignIn).toHaveBeenCalledWith("zitadel", {
      callbackUrl: window.location.href,
    });
  });

  it("does not call signIn for other error values", () => {
    mockUseSession.mockReturnValue({
      data: { error: "SomeOtherError" },
    });
    render(<SessionGuard />);
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

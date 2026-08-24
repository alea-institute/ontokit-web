import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const sessionState = {
  data: null as null | { user?: { id?: string; email?: string } },
  status: "loading" as "loading" | "authenticated" | "unauthenticated",
};

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
}));

import { ByoKeySessionGuard } from "@/components/auth/ByoKeySessionGuard";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

describe("ByoKeySessionGuard", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
    sessionState.data = null;
    sessionState.status = "loading";
    useByoKeyStore.setState({ ownerId: null, entries: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("clears tab-scoped keys on an account switch even when auth UI is hidden", () => {
    sessionState.data = { user: { id: "user-a", email: "a@example.org" } };
    sessionState.status = "authenticated";
    useByoKeyStore.setState({
      ownerId: "user-a",
      entries: {
        "project-1": { provider: "openai", key: "secret-a", validatedAt: null },
      },
    });

    const { rerender } = render(<ByoKeySessionGuard />);
    expect(useByoKeyStore.getState().entries["project-1"]?.key).toBe("secret-a");

    sessionState.data = { user: { id: "user-b", email: "b@example.org" } };
    rerender(<ByoKeySessionGuard />);

    expect(useByoKeyStore.getState().ownerId).toBe("user-b");
    expect(useByoKeyStore.getState().entries).toEqual({});
  });
});

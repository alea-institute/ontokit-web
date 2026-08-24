import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MemberTrust } from "@/lib/api/trust";

vi.mock("@/lib/api/trust", () => ({
  trustApi: { setMemberTrust: vi.fn() },
}));

import { trustApi } from "@/lib/api/trust";
import { MemberTrustControl } from "@/components/projects/MemberTrustControl";

const mockedSetMemberTrust = trustApi.setMemberTrust as unknown as ReturnType<typeof vi.fn>;

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

describe("MemberTrustControl authoritative refresh", () => {
  it("yields an optimistic result to a later authoritative trust prop", async () => {
    const user = userEvent.setup();
    let resolveUpdate: (value: MemberTrust) => void = () => {};
    mockedSetMemberTrust.mockImplementation(
      () =>
        new Promise<MemberTrust>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const initial = memberTrust();
    const { rerender } = render(
      <MemberTrustControl
        projectId="proj-1"
        userId="u1"
        trust={initial}
        token="test-token"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Trust status for this member/ }));
    await user.click(screen.getByRole("menuitem", { name: /Grant trusted/ }));
    expect(await screen.findByText("Trusted (granted)")).toBeDefined();

    await act(async () => {
      resolveUpdate(
        memberTrust({ trust_override: "granted", is_trusted: true, tier: "trusted" }),
      );
    });
    await waitFor(() => expect(mockedSetMemberTrust).toHaveBeenCalledTimes(1));

    rerender(
      <MemberTrustControl
        projectId="proj-1"
        userId="u1"
        trust={memberTrust({ trust_override: "revoked" })}
        token="test-token"
      />,
    );

    expect(await screen.findByText("Trust revoked")).toBeDefined();
    expect(screen.queryByText("Trusted (granted)")).toBeNull();
  });
});

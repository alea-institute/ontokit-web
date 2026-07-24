/**
 * U15 — the anonymous post-submit account nudge (R7, KTD12).
 *
 * Deliberately thin: this unit is copy plus a sign-in CTA, and the only thing
 * worth pinning is that the nudge appears for the contributor who could act on
 * it and stays out of the way of the one who already has.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalSubmittedDialog } from "@/components/editor/ProposalSubmittedDialog";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  prNumber: 42,
  prUrl: null,
};

describe("ProposalSubmittedDialog", () => {
  it("renders the nudge and a working sign-in CTA for an anonymous submitter", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<ProposalSubmittedDialog {...baseProps} isSignedIn={false} onSignIn={onSignIn} />);

    expect(screen.getByText(/Thank you — your proposal is in/)).toBeDefined();
    expect(screen.getByText(/proposal #42/)).toBeDefined();
    expect(
      screen.getByText(/becoming a trusted contributor/i),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Create an account or sign in/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not nudge a signed-in submitter", () => {
    render(<ProposalSubmittedDialog {...baseProps} isSignedIn onSignIn={vi.fn()} />);

    expect(screen.getByText(/Thank you — your proposal is in/)).toBeDefined();
    expect(screen.queryByText(/becoming a trusted contributor/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Create an account or sign in/ })).toBeNull();
  });

  it("omits the sign-in CTA when there is no sign-in to offer", () => {
    render(<ProposalSubmittedDialog {...baseProps} isSignedIn={false} />);

    // The explanation still stands on its own — it is true whether or not
    // this deployment has an identity provider configured.
    expect(screen.getByText(/becoming a trusted contributor/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Create an account or sign in/ })).toBeNull();
  });

  it("links out to the proposal when the server returned a URL", () => {
    render(
      <ProposalSubmittedDialog
        {...baseProps}
        prUrl="https://example.org/pr/42"
        isSignedIn={false}
      />,
    );
    const link = screen.getByRole("link", { name: /View proposal/ });
    expect(link.getAttribute("href")).toBe("https://example.org/pr/42");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders nothing while closed", () => {
    render(<ProposalSubmittedDialog {...baseProps} open={false} isSignedIn={false} />);
    expect(screen.queryByText(/Thank you — your proposal is in/)).toBeNull();
  });
});

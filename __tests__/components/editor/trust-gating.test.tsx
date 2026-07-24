/**
 * U13 — tier-aware editor gating and the trust explainer.
 *
 * The rule under test is AE2: an untrusted contributor who reaches for "new
 * class" finds the action disabled *with an explanation of how trust is
 * earned*, while proposing edits to existing entities keeps working. The
 * fail-safe direction matters as much as the happy path — while capabilities
 * are unknown (loading, or a failed fetch), minting stays locked.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Radix menu parts need a Menu root; the context menu is exercised here for
// its trust wiring, not its portalling, so the primitives are stood in for.
vi.mock("@/components/ui/context-menu", () => ({
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => {
    const text = React.Children.toArray(children)
      .filter((c) => typeof c === "string")
      .join("")
      .trim();
    return (
      <button data-testid={`menu-item-${text}`} disabled={disabled} onClick={onSelect}>
        {children}
      </button>
    );
  },
  ContextMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="menu-label">{children}</p>
  ),
  ContextMenuSeparator: () => <hr />,
}));

import { AddEntityDialog } from "@/components/editor/AddEntityDialog";
import {
  TrustExplainer,
  TrustExplainerPanel,
  mintingLockReason,
  type TrustGate,
} from "@/components/editor/TrustExplainer";
import { TreeNodeContextMenu } from "@/components/editor/TreeNodeContextMenu";
import { derivePermissions } from "@/lib/hooks/useProject";
import type { Project } from "@/lib/api/projects";

vi.mock("@/lib/ontology/iriGeneration", () => ({
  labelToLocalName: (label: string) => label.replace(/\s+/g, ""),
  uuidToBase62: () => "TestBase62Uuid",
}));

function gate(overrides: Partial<TrustGate> = {}): TrustGate {
  return {
    tier: "untrusted",
    locked: true,
    isLoading: false,
    isError: false,
    progress: { accepted: 2, threshold: 5, remaining: 3 },
    ...overrides,
  };
}

const dialogProps = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  iriPattern: "uuid" as const,
  nextNumeric: 1,
  ontologyNamespace: "http://example.org/ontology#",
};

function suggesterProject(): Project {
  return { id: "p1", name: "Test", user_role: "suggester" } as unknown as Project;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddEntityDialog trust gating", () => {
  it("Covers AE2 — an untrusted contributor gets a disabled Create with the trust explanation", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddEntityDialog {...dialogProps} trustGate={gate()} />);

    // The explanation is present, and names the way up the ladder.
    expect(screen.getByText("How trust is earned")).toBeDefined();
    expect(screen.getByText(/each one a reviewer accepts moves you up/i)).toBeDefined();

    // The minting action is disabled — visible, but inert.
    const create = screen.getByRole("button", { name: "Create" });
    expect((create as HTMLButtonElement).disabled).toBe(true);

    // Even with a label typed in, Create never fires onConfirm.
    const labelInput = screen.getByLabelText("Label") as HTMLInputElement;
    expect(labelInput.disabled).toBe(true);
    await user.click(create);
    expect(dialogProps.onConfirm).not.toHaveBeenCalled();
  });

  it("Covers AE2 — proposing edits to existing entities stays available while minting is locked", () => {
    // The ladder gates minting only. `canSuggest` — the permission behind the
    // propose-edit path — is untouched by a locked minting capability.
    const perms = derivePermissions(suggesterProject(), "token", {
      can_mint_entities: false,
    });
    expect(perms.canSuggest).toBe(true);
    expect(perms.canMintEntities).toBe(false);
  });

  it("enables Create and hides the explainer once the contributor may mint", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <AddEntityDialog
        {...dialogProps}
        trustGate={gate({ tier: "trusted", locked: false, progress: null })}
      />,
    );

    expect(screen.queryByText("How trust is earned")).toBeNull();

    const labelInput = screen.getByLabelText("Label") as HTMLInputElement;
    expect(labelInput.disabled).toBe(false);
    await user.type(labelInput, "Privileged Altar");

    const create = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    expect(create.disabled).toBe(false);
    await user.click(create);
    expect(dialogProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps minting disabled while capabilities are still loading (fail-safe, not fail-open)", () => {
    render(
      <AddEntityDialog
        {...dialogProps}
        trustGate={gate({ tier: null, isLoading: true, progress: null })}
      />,
    );

    expect(screen.getByText(/Checking what you can do here/i)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("keeps minting disabled after a capabilities fetch error and offers a retry", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRetry = vi.fn();
    render(
      <AddEntityDialog
        {...dialogProps}
        trustGate={gate({ tier: null, isError: true, progress: null, onRetry })}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("TrustExplainerPanel", () => {
  it("shows N of M accepted from the capabilities payload", () => {
    render(<TrustExplainerPanel gate={gate()} />);

    expect(screen.getByText("2 of 5 accepted")).toBeDefined();
    expect(screen.getByText("3 more accepted suggestions to go.")).toBeDefined();

    const meter = screen.getByRole("progressbar", {
      name: "Progress toward trusted status",
    });
    expect(meter.getAttribute("aria-valuenow")).toBe("2");
    expect(meter.getAttribute("aria-valuemax")).toBe("5");
  });

  it("uses the singular when one acceptance remains", () => {
    render(
      <TrustExplainerPanel
        gate={gate({ progress: { accepted: 4, threshold: 5, remaining: 1 } })}
      />,
    );
    expect(screen.getByText("1 more accepted suggestion to go.")).toBeDefined();
  });

  it("offers anonymous visitors a sign-in CTA rather than a trust-progress count", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSignIn = vi.fn();
    render(
      <TrustExplainerPanel
        gate={gate({ tier: "anonymous", progress: null, onSignIn })}
      />,
    );

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/accepted$/)).toBeNull();
    expect(screen.getByText(/no account needed/i)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

describe("TrustExplainer disclosure", () => {
  it("renders nothing when minting is not locked", () => {
    const { container } = render(
      <TrustExplainer gate={gate({ locked: false })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("opens and closes the explanation from the keyboard", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TrustExplainer gate={gate()} />);

    const trigger = screen.getByRole("button", { name: /Why can't I add entries/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("dialog", { name: "How trust is earned" });
    expect(panel.id).toBe(trigger.getAttribute("aria-controls"));
    expect(screen.getByText("2 of 5 accepted")).toBeDefined();

    // Escape closes it and hands focus back to the trigger.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("mintingLockReason", () => {
  it("says nothing when the gate is open", () => {
    expect(mintingLockReason(gate({ locked: false }))).toBe("");
    expect(mintingLockReason(undefined)).toBe("");
  });

  it("names the remaining acceptances for an untrusted contributor", () => {
    expect(mintingLockReason(gate())).toContain("3 more accepted suggestions");
  });

  it("points an anonymous visitor at signing in", () => {
    expect(
      mintingLockReason(gate({ tier: "anonymous", progress: null })),
    ).toContain("Sign in");
  });

  it("explains the unknown states rather than going quiet", () => {
    expect(mintingLockReason(gate({ isLoading: true }))).toContain("Checking");
    expect(mintingLockReason(gate({ isError: true }))).toContain("couldn't check");
  });
});

describe("TreeNodeContextMenu trust gating", () => {
  const node = { iri: "http://example.org/ontology#Person", label: "Person" };

  it("disables Add Subclass and shows the reason instead of hiding the item", () => {
    const onAddChild = vi.fn();
    render(
      <TreeNodeContextMenu
        node={node}
        onAddChild={onAddChild}
        addChildLocked
        addChildLockedReason="Creating new entries requires trusted status."
      />,
    );

    const item = screen.getByTestId("menu-item-Add Subclass") as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(
      screen.getByText("Creating new entries requires trusted status."),
    ).toBeDefined();
  });

  it("leaves Add Subclass enabled for a contributor who may mint", () => {
    render(<TreeNodeContextMenu node={node} onAddChild={vi.fn()} />);
    const item = screen.getByTestId("menu-item-Add Subclass") as HTMLButtonElement;
    expect(item.disabled).toBe(false);
    expect(screen.queryByTestId("menu-label")).toBeNull();
  });
});

describe("derivePermissions canMintEntities", () => {
  it("sources minting from the capabilities payload, not from roles", () => {
    const project = suggesterProject();
    expect(derivePermissions(project, "token", { can_mint_entities: true }).canMintEntities).toBe(true);
    expect(derivePermissions(project, "token", { can_mint_entities: false }).canMintEntities).toBe(false);
  });

  it("defaults to false when capabilities are unknown", () => {
    // An editor would resolve to the reviewer tier server-side, but until the
    // capabilities call answers, the client must not assume it.
    const editorProject = { id: "p1", name: "T", user_role: "editor" } as unknown as Project;
    const perms = derivePermissions(editorProject, "token");
    expect(perms.canEdit).toBe(true);
    expect(perms.canMintEntities).toBe(false);
  });
});

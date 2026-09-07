import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
  useRouter: () => navigation,
}));

import { RetiredDemoNotice } from "@/components/projects/retired-demo-notice";

const OLD = "11111111-1111-4111-8111-111111111111";
const CURRENT = "22222222-2222-4222-8222-222222222222";

describe("RetiredDemoNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", `/projects/${CURRENT}/editor`);
  });

  it("announces the reset and dismisses only the flag through native history", async () => {
    window.history.replaceState(null, "", `?classIri=x&branch=main&retired_from=${OLD}#source`);
    const { rerender } = render(<RetiredDemoNotice projectId={CURRENT} />);
    expect(screen.getByRole("status").textContent).toContain("This demo has reset");
    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss retired demo notice" }));
    expect(window.location.pathname).toBe(`/projects/${CURRENT}/editor`);
    expect(window.location.search).toBe("?classIri=x&branch=main");
    expect(window.location.hash).toBe("#source");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
    rerender(<RetiredDemoNotice projectId={CURRENT} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["", "invalid", `${OLD}%0A`, CURRENT, CURRENT.toUpperCase()])("hides the notice for invalid or absent chain %s", (value) => {
    window.history.replaceState(null, "", `?retired_from=${value}`);
    render(<RetiredDemoNotice projectId={CURRENT} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("retains valid predecessors in a mixed chain", () => {
    window.history.replaceState(null, "", `?retired_from=invalid,${CURRENT},${OLD}`);
    render(<RetiredDemoNotice projectId={CURRENT} />);
    expect(screen.getByRole("status")).toBeDefined();
  });
});

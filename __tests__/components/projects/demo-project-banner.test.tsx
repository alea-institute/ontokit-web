import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectState, navigation } = vi.hoisted(() => ({
  navigation: { search: "", replace: vi.fn() },
  projectState: {
    is_demo: false,
    name: "FOLIO Demo",
    demo_source_project_id: "folio-live" as string | undefined,
    demo_repository_full_name: "alea-institute/ontokit-demo-folio" as string | undefined,
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "22222222-2222-4222-8222-222222222222" }),
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => "/projects/22222222-2222-4222-8222-222222222222/editor",
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/hooks/useProject", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/hooks/useProject")>(),
  useProject: () => ({ project: projectState }),
}));

import { DemoProjectShell } from "@/components/projects/demo-project-banner";

describe("DemoProjectBanner", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockClear();
    projectState.is_demo = false;
    projectState.demo_source_project_id = "folio-live";
    projectState.demo_repository_full_name = "alea-institute/ontokit-demo-folio";
  });

  it("renders only when the project response says it is a demo", () => {
    const { rerender } = render(
      <DemoProjectShell><main>Project route</main></DemoProjectShell>,
    );
    expect(screen.queryByLabelText("Demo workspace notice")).toBeNull();

    projectState.is_demo = true;
    rerender(<DemoProjectShell><main>Project route</main></DemoProjectShell>);
    expect(screen.getByLabelText("Demo workspace notice")).toBeDefined();
    expect(screen.getByText(/alea-institute\/ontokit-demo-folio/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Return to source/ }).getAttribute("href"))
      .toBe("/projects/folio-live");
  });

  it("stays in the project shell flow below modal layers", () => {
    projectState.is_demo = true;

    render(<DemoProjectShell><main>Project route</main></DemoProjectShell>);

    const notice = screen.getByLabelText("Demo workspace notice");
    expect(notice.className).toContain("sticky");
    expect(notice.className).toContain("top-0");
    expect(notice.className).toContain("z-30");
    expect(notice.className).toContain("w-full");
    expect(notice.className).not.toContain("fixed");
    expect(notice.className).not.toContain("bottom-3");
    expect(notice.className).not.toContain("z-50");
  });

  it("keeps the status text and exit control usable at mobile widths", async () => {
    projectState.is_demo = true;
    const user = userEvent.setup();

    render(<DemoProjectShell><main>Project route</main></DemoProjectShell>);

    const notice = screen.getByLabelText("Demo workspace notice");
    const noticeContent = notice.firstElementChild as HTMLElement;
    expect(noticeContent.className).toContain("flex-col");
    expect(noticeContent.className).toContain("sm:flex-row");
    expect(screen.getByText(/Changes may disappear when this project resets/)).toBeDefined();
    const exitLink = screen.getByRole("link", { name: /Return to source/ });
    expect(exitLink.className).toContain("min-h-11");
    await user.tab();
    expect(document.activeElement).toBe(exitLink);
  });

  it("reserves viewport space and scrolls project routes below the notice", () => {
    projectState.is_demo = true;

    const { container } = render(
      <DemoProjectShell><main>Project route marker</main></DemoProjectShell>,
    );

    const shell = container.firstElementChild as HTMLElement;
    const routeScroller = screen.getByTestId("project-route-scroll-region");
    expect(shell.className).toContain("h-dvh");
    expect(shell.className).toContain("overflow-hidden");
    expect(routeScroller.className).toContain("min-h-0");
    expect(routeScroller.className).toContain("flex-1");
    expect(routeScroller.className).toContain("overflow-auto");
    expect(shell.firstElementChild).toBe(screen.getByLabelText("Demo workspace notice"));
    expect(shell.lastElementChild).toBe(routeScroller);
  });

  it("does not change the project route layout outside demo workspaces", () => {
    const { container } = render(
      <DemoProjectShell><main>Project route marker</main></DemoProjectShell>,
    );

    expect(screen.queryByLabelText("Demo workspace notice")).toBeNull();
    expect(screen.queryByTestId("project-route-scroll-region")).toBeNull();
    expect(container.firstElementChild?.tagName).toBe("MAIN");
  });

  it("falls back to honest project metadata when optional demo links are absent", () => {
    projectState.is_demo = true;
    projectState.demo_source_project_id = undefined;
    projectState.demo_repository_full_name = undefined;

    render(<DemoProjectShell><main>Project route</main></DemoProjectShell>);

    expect(screen.getByText(/Demo workspace: FOLIO Demo/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Return to source/ }).getAttribute("href"))
      .toBe("/");
  });
  it("places the retirement status above the demo workspace banner", () => {
    projectState.is_demo = true;
    navigation.search = "retired_from=11111111-1111-4111-8111-111111111111";
    render(<DemoProjectShell><main>Project route</main></DemoProjectShell>);
    const retired = screen.getByRole("status", { name: "Retired demo notice" });
    expect(retired.nextElementSibling).toBe(screen.getByLabelText("Demo workspace notice"));
  });

  it.each(["", "invalid", "11111111-1111-4111-8111-111111111111%0A", "22222222-2222-4222-8222-222222222222"])("strips invalid retirement flag %s without navigation", (value) => {
    projectState.is_demo = true;
    navigation.search = `retired_from=${value}&branch=main`;
    render(<DemoProjectShell><main>Project route</main></DemoProjectShell>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.location.search).toBe("?branch=main");
    expect(navigation.replace).not.toHaveBeenCalled();
  });

});

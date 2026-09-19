import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import DocsLayout from "@/app/docs/layout";
import DocsPage from "@/app/docs/page";
import GuideLayout from "@/app/docs/guide/layout";
import GuidePage from "@/app/docs/guide/page";
import Introduction from "@/app/docs/guide/introduction/page";
import Types from "@/app/docs/guide/types/page";
import Formats from "@/app/docs/guide/formats/page";
import Syntax from "@/app/docs/guide/syntax/page";
import Vocabularies from "@/app/docs/guide/vocabularies/page";
import Properties from "@/app/docs/guide/properties/page";
import Changelog from "@/app/docs/changelog/page";
import InfoPage from "@/app/info/page";

const boundary = vi.hoisted(() => ({ pathname: "/docs" }));
vi.mock("next/navigation", () => ({ usePathname: () => boundary.pathname }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }), signIn: vi.fn(), signOut: vi.fn() }));
let client: QueryClient;
function mount(children: ReactNode) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><DocsLayout>{children}</DocsLayout></QueryClientProvider>);
}
const chapters = [
  { slug: "introduction", Page: Introduction, title: "What is an Ontology?" },
  { slug: "types", Page: Types, title: "What are the Types of Ontologies?" },
  { slug: "formats", Page: Formats, title: "What are the Ontology Formats?" },
  { slug: "syntax", Page: Syntax, title: "What is an Ontology Syntax?" },
  { slug: "vocabularies", Page: Vocabularies, title: "What is an Ontology Vocabulary?" },
  { slug: "properties", Page: Properties, title: "What are Properties?" },
];
beforeEach(() => {
  boundary.pathname = "/docs";
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Documentation should not request remote data for an anonymous reader"); }));
});
afterEach(() => { cleanup(); client?.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("documentation routes composed with their real layouts and navigation", () => {
  it("exposes the API reference from documentation content inside the main landmark", () => {
    mount(<DocsPage />);
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    expect(within(main).getByRole("heading", { level: 1, name: "Documentation" })).toBeDefined();
    expect(within(main).getByRole("link").getAttribute("href")).toBe("/api-docs");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lists all six guide chapters with distinct working route destinations", () => {
    boundary.pathname = "/docs/guide";
    mount(<GuideLayout><GuidePage /></GuideLayout>);
    const heading = screen.getByRole("heading", { level: 1, name: "Guide to Ontologies" });
    const cards = within(heading.parentElement!).getAllByRole("link");
    expect(cards.map(link => link.getAttribute("href"))).toEqual(chapters.map(chapter => `/docs/guide/${chapter.slug}`));
    for (const chapter of chapters) expect(within(heading.parentElement!).getByRole("heading", { name: chapter.title })).toBeDefined();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it.each(chapters)("renders $slug with the right sidebar selection and adjacent chapters", ({ slug, Page, title }) => {
    boundary.pathname = `/docs/guide/${slug}`;
    mount(<GuideLayout><Page /></GuideLayout>);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeDefined();
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe(boundary.pathname);
    const index = chapters.findIndex(chapter => chapter.slug === slug);
    const previous = screen.queryByRole("link", { name: /^Previous/ });
    const next = screen.queryByRole("link", { name: /^Next/ });
    if (index === 0) expect(previous).toBeNull();
    else expect(previous?.getAttribute("href")).toBe(`/docs/guide/${chapters[index - 1].slug}`);
    if (index === chapters.length - 1) expect(next).toBeNull();
    else expect(next?.getAttribute("href")).toBe(`/docs/guide/${chapters[index + 1].slug}`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["/docs", "Documentation"], ["/docs/guide/properties", "Ontology Guide"], ["/docs/changelog", "Changelog"],
  ])("keeps exactly one documentation tab active at %s", (pathname, label) => {
    boundary.pathname = pathname;
    mount(<p>Route content</p>);
    const nav = screen.getByRole("link", { name: "Ontology Guide" }).closest("nav")!;
    const active = within(nav).getAllByRole("link").filter(link => link.classList.contains("border-blue-600"));
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toBe(label);
  });

  it("connects release links to real sections and updates the active release on scroll", () => {
    boundary.pathname = "/docs/changelog";
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(10000);
    vi.stubGlobal("innerHeight", 700);
    vi.stubGlobal("scrollY", 0);
    mount(<Changelog />);
    const releases = screen.getByRole("navigation", { name: "Releases" });
    const links = within(releases).getAllByRole("link");
    expect(links.length).toBeGreaterThan(1);
    links.forEach((link, index) => {
      const id = link.getAttribute("href")!.slice(1);
      const section = document.getElementById(id)!;
      expect(section).not.toBeNull();
      expect(within(section).getByRole("heading", { level: 2 }).textContent).not.toBe("");
      vi.spyOn(section, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, index * 600 - window.scrollY, 500, 500));
    });
    fireEvent.scroll(window);
    expect(links[0].getAttribute("aria-current")).toBe("true");
    vi.stubGlobal("scrollY", 600);
    fireEvent.scroll(window);
    expect(links[1].getAttribute("aria-current")).toBe("true");
    expect(links[0].hasAttribute("aria-current")).toBe(false);
  });
  it("connects the public information page to the project browser and repository", () => {
    boundary.pathname = "/info";
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><InfoPage /></QueryClientProvider>);
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    expect(within(main).getByRole("heading", { level: 1, name: "OntoKit" })).toBeDefined();
    expect(within(main).getByRole("link", { name: "Browse Projects" }).getAttribute("href")).toBe("/");
    const repository = within(main).getByRole("link", { name: "View on GitHub" });
    expect(repository.getAttribute("href")).toBe("https://github.com/CatholicOS/ontokit-web");
    expect(repository.getAttribute("target")).toBe("_blank");
    expect(repository.getAttribute("rel")).toContain("noopener");
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Info" }).className).toContain("bg-blue-100");
    expect(fetch).not.toHaveBeenCalled();
  });

});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/docs/guide-chapters", () => ({
  getAdjacentChapters: (slug: string) => {
    if (slug === "middle") {
      return {
        prev: { slug: "first", title: "First Chapter" },
        next: { slug: "last", title: "Last Chapter" },
      };
    }
    if (slug === "first") {
      return {
        prev: null,
        next: { slug: "middle", title: "Middle Chapter" },
      };
    }
    if (slug === "last") {
      return {
        prev: { slug: "middle", title: "Middle Chapter" },
        next: null,
      };
    }
    return { prev: null, next: null };
  },
}));

describe("GuidePrevNext", () => {
  it("renders both prev and next links for middle slug", () => {
    render(<GuidePrevNext currentSlug="middle" />);
    expect(screen.getByText("First Chapter")).toBeDefined();
    expect(screen.getByText("Last Chapter")).toBeDefined();
    expect(screen.getByText("Previous")).toBeDefined();
    expect(screen.getByText("Next")).toBeDefined();
  });

  it("renders only next link when no prev", () => {
    render(<GuidePrevNext currentSlug="first" />);
    expect(screen.queryByText("Previous")).toBeNull();
    expect(screen.getByText("Next")).toBeDefined();
    expect(screen.getByText("Middle Chapter")).toBeDefined();
  });

  it("renders only prev link when no next", () => {
    render(<GuidePrevNext currentSlug="last" />);
    expect(screen.getByText("Previous")).toBeDefined();
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.getByText("Middle Chapter")).toBeDefined();
  });

  it("renders correct href for links", () => {
    render(<GuidePrevNext currentSlug="middle" />);
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/docs/guide/first");
    expect(links[1].getAttribute("href")).toBe("/docs/guide/last");
  });

  it("renders empty divs when no prev or next", () => {
    render(<GuidePrevNext currentSlug="unknown" />);
    expect(screen.queryByText("Previous")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });
});

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The header is shared chrome with its own tests; the policy text is what
// these tests guard.
vi.mock("@/components/layout/header", () => ({
  Header: () => <header data-testid="header" />,
}));

import PrivacyPage, { metadata } from "@/app/privacy/page";

/** Approved policy text, byte-identical to the attorney-approved source. */
const MARKDOWN = readFileSync(
  join(process.cwd(), "__tests__/fixtures/privacy-policy.md"),
  "utf8",
);

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** One entry per markdown block (heading, paragraph, list item), syntax stripped. */
function markdownBlocks(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^-\s+/, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, ""),
    )
    .map(normalize);
}

const SECTION_HEADINGS = MARKDOWN.split("\n")
  .filter((line) => line.startsWith("### "))
  .map((line) => line.slice(4).trim());

function renderPolicy() {
  render(<PrivacyPage />);
  const article = document.querySelector("article");
  if (!article) throw new Error("Policy article not rendered");
  return article;
}

describe("Privacy policy page", () => {
  it("exports page metadata", () => {
    expect(metadata.title).toBe("Privacy policy · OntoKit");
    expect(typeof metadata.description).toBe("string");
  });

  it("renders the title as the only h1", () => {
    renderPolicy();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("OntoKit privacy policy");
  });

  it("renders every section heading exactly, in order, as h2", () => {
    renderPolicy();
    expect(SECTION_HEADINGS).toHaveLength(8);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(SECTION_HEADINGS);
  });

  it("makes the contact address a mailto link", () => {
    renderPolicy();
    const links = screen.getAllByRole("link", { name: "privacy@damienriehl.com" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("mailto:privacy@damienriehl.com");
    }
  });

  it("renders the approved text verbatim, block by block", () => {
    const article = renderPolicy();
    const rendered = Array.from(article.querySelectorAll("h1, h2, p, li")).map((el) =>
      normalize(el.textContent ?? ""),
    );
    expect(rendered).toEqual(markdownBlocks(MARKDOWN));
  });

  it("renders the approved text verbatim as a whole", () => {
    const article = renderPolicy();
    expect(normalize(article.textContent ?? "").replace(/\s/g, "")).toBe(
      markdownBlocks(MARKDOWN).join("").replace(/\s/g, ""),
    );
  });

  it("links the privacy policy from its own footer", () => {
    renderPolicy();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
  });
});

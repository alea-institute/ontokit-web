import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageFlag } from "@/components/editor/LanguageFlag";

describe("LanguageFlag", () => {
  it("renders a flag emoji for 'en'", () => {
    render(<LanguageFlag lang="en" />);
    const el = screen.getByRole("img");
    expect(el).toBeDefined();
    expect(el.getAttribute("aria-label")).toBe("Language: en");
  });

  it("renders a flag emoji for 'fr'", () => {
    render(<LanguageFlag lang="fr" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe("Language: fr");
  });

  it("renders a flag emoji for 'de'", () => {
    render(<LanguageFlag lang="de" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe("Language: de");
  });

  it("sets title to the language code", () => {
    render(<LanguageFlag lang="it" />);
    expect(screen.getByTitle("it")).toBeDefined();
  });

  it("renders aria-hidden when lang is empty string", () => {
    const { container } = render(<LanguageFlag lang="" />);
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-hidden")).toBe("true");
    expect(span?.getAttribute("role")).toBeNull();
  });

  it("does not set title when lang is empty", () => {
    const { container } = render(<LanguageFlag lang="" />);
    const span = container.querySelector("span");
    expect(span?.getAttribute("title")).toBeNull();
  });

  it("handles language tags with region codes (e.g. en-US)", () => {
    render(<LanguageFlag lang="en-US" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe("Language: en-US");
  });

  it("applies default className when none is provided", () => {
    const { container } = render(<LanguageFlag lang="en" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("inline-flex");
    expect(span?.className).toContain("h-5");
    expect(span?.className).toContain("w-5");
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <LanguageFlag lang="en" className="custom-class text-lg" />
    );
    const span = container.querySelector("span");
    expect(span?.className).toBe("custom-class text-lg");
  });

  it("renders without crashing for unknown lang codes", () => {
    const { container } = render(<LanguageFlag lang="xyz" />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
  });
});

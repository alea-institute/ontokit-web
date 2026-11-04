import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SiteFooter } from "@/components/layout/site-footer";

describe("SiteFooter", () => {
  it("links to the privacy policy", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: "Privacy" });
    expect(link.getAttribute("href")).toBe("/privacy");
  });
});

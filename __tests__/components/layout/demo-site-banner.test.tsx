import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DEMO_SITE_BANNER_COPY, DemoSiteBanner } from "@/components/layout/demo-site-banner";

const EXACT_COPY =
  "OntoKit demo: preview how communities build the Catholic Semantic Canon and FOLIO together. Suggestions here land in demo copies on GitHub, never the official ontologies.";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DemoSiteBanner", () => {
  it("renders the exact notice in a labelled region when NEXT_PUBLIC_DEMO_SITE is \"true\"", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_SITE", "true");
    render(<DemoSiteBanner />);

    const region = screen.getByRole("region", { name: "Demo site notice" });
    expect(region.textContent).toBe(EXACT_COPY);
    expect(DEMO_SITE_BANNER_COPY).toBe(EXACT_COPY);
    // Not dismissible: no controls inside the notice.
    expect(region.querySelector("button")).toBeNull();
  });

  it.each([["unset", undefined], ["empty", ""], ["false", "false"], ["TRUE", "TRUE"], ["1", "1"]])(
    "renders nothing when the flag is %s",
    (_label, value) => {
      vi.stubEnv("NEXT_PUBLIC_DEMO_SITE", value as string);
      const { container } = render(<DemoSiteBanner />);
      expect(container.innerHTML).toBe("");
      expect(screen.queryByRole("region", { name: "Demo site notice" })).toBeNull();
    },
  );
});

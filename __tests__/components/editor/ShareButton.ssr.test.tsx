// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareButton } from "@/components/editor/ShareButton";
import { ToastProvider } from "@/lib/context/ToastContext";

describe("share controls rendered without a browser", () => {
  it.each([null, "https://example.test#Person"])("renders accessible sharing controls for selected IRI %s", selectedIri => {
    expect(typeof window).toBe("undefined");
    const html = renderToStaticMarkup(<ToastProvider><ShareButton projectId="project" selectedIri={selectedIri} /></ToastProvider>);
    expect(html).toContain(selectedIri ? 'aria-label="Copy link to Person"' : 'aria-label="Copy project link"');
    if (selectedIri) expect(html).toContain('aria-label="More share options"');
    else expect(html).not.toContain('aria-label="More share options"');
    expect(html).not.toContain('role="menu"');
  });
});

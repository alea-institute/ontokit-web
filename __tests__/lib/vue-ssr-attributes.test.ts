import { describe, expect, it } from "vitest";
import { ssrRenderAttrs } from "@vue/server-renderer";

describe("Vue SSR attribute safety", () => {
  it("does not turn carriage returns in attribute names into extra HTML attributes", () => {
    const markup = ssrRenderAttrs({
      "x\rautofocus\ronfocus": "void 0",
      "aria-label": "Ontology <catalog>",
    });
    const element = document.createElement("div");
    element.innerHTML = `<div${markup}></div>`;
    const rendered = element.firstElementChild!;
    expect(rendered.getAttribute("aria-label")).toBe("Ontology <catalog>");
    expect(rendered.hasAttribute("autofocus")).toBe(false);
    expect(rendered.hasAttribute("onfocus")).toBe(false);
  });
});

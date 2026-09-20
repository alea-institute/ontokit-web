import { renderToStaticMarkup } from "react-dom/server";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "@/app/layout";
import { useToast } from "@/lib/context/ToastContext";

// Font compilation and script scheduling belong to Next's build/runtime.
// The root layout, inline bootstrap source and provider stack stay real.
vi.mock("next/font/google", () => ({
  Inter: ({ variable }: { variable: string }) => ({ variable }),
  JetBrains_Mono: ({ variable }: { variable: string }) => ({ variable }),
  Noto_Color_Emoji: ({ variable }: { variable: string }) => ({ variable }),
}));
vi.mock("next/script", () => ({ default: ({ id, strategy, children }: { id: string; strategy: string; children: string }) => <script id={id} data-strategy={strategy}>{children}</script> }));

function Consumer() {
  const query = useQueryClient();
  const session = useSession();
  const toast = useToast();
  return <main id="main-content"><h1>Layout child</h1><p>{session.status}</p><output>{query.getDefaultOptions().queries?.staleTime === 60000 && typeof toast.addToast === "function" ? "providers available" : "missing providers"}</output></main>;
}
function renderDocument() {
  return new DOMParser().parseFromString(renderToStaticMarkup(<RootLayout><Consumer /></RootLayout>), "text/html");
}
beforeEach(() => {
  localStorage.removeItem("ontokit-editor-preferences");
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.removeItem("ontokit-editor-preferences");
  document.documentElement.classList.remove("dark");
});

describe("root layout, real providers and pre-hydration theme bootstrap", () => {
  it("composes the accessibility landmark, provider consumers and font variables", () => {
    const doc = renderDocument();
    expect(doc.documentElement.lang).toBe("en");
    const skip = doc.querySelector('a[href="#main-content"]');
    expect(skip?.textContent).toBe("Skip to main content");
    expect(doc.getElementById("main-content")?.textContent).toContain("providers available");
    expect(doc.querySelector("h1")?.textContent).toBe("Layout child");
    expect(doc.body.className).toContain("--font-inter");
    expect(doc.body.className).toContain("--font-jetbrains-mono");
    expect(doc.body.className).toContain("--font-noto-emoji");
    expect(metadata.title).toBe("OntoKit - Collaborative Ontology Editor");
    expect(doc.querySelector("#theme-init")?.getAttribute("data-strategy")).toBe("beforeInteractive");
  });

  it.each([
    ["dark", false, true], ["light", true, false], ["system", true, true], ["system", false, false],
    [null, true, true],
  ] as const)("applies theme %s with system dark=%s before hydration", (theme, systemDark, expectedDark) => {
    if (theme) localStorage.setItem("ontokit-editor-preferences", JSON.stringify({ state: { theme } }));
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: systemDark })));
    const script = renderDocument().getElementById("theme-init")!.textContent!;
    new Function(script)();
    expect(document.documentElement.classList.contains("dark")).toBe(expectedDark);
    expect(localStorage.getItem("ontokit-editor-preferences")).toBe(theme ? JSON.stringify({ state: { theme } }) : null);
  });

  it.each(["malformed", "unavailable"])("does not break page bootstrap when persisted preferences are %s", state => {
    const script = renderDocument().getElementById("theme-init")!.textContent!;
    if (state === "malformed") localStorage.setItem("ontokit-editor-preferences", "not-json");
    else vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    expect(() => new Function(script)()).not.toThrow();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

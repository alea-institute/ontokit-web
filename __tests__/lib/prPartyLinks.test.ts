import { describe, expect, it } from "vitest";
import { trustedGitHubUrl } from "@/lib/prPartyLinks";

describe("trustedGitHubUrl", () => {
  it.each([
    "javascript:alert(1)",
    "https://ontokit.example/pr-party",
    "https://github.com.attacker.example/x",
    "https://attacker.example/github.com/x",
    "https://github.com\\@attacker.example/x",
    "https:\\\\github.com\\catholicos\\repo",
    "http://github.com/catholicos/repo",
  ])("rejects hostile navigation target %s", (url) => {
    expect(trustedGitHubUrl(url)).toBeNull();
  });

  it("accepts only an HTTPS URL on the exact github.com hostname", () => {
    expect(trustedGitHubUrl("https://github.com/catholicos/repo/pull/1")).toBe(
      "https://github.com/catholicos/repo/pull/1",
    );
  });
});

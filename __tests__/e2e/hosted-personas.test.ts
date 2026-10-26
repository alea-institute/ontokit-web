// @vitest-environment node
import {describe, expect, it, vi, beforeEach} from "vitest";
import type {Page} from "@playwright/test";
import type {SuggestionsRunConfig} from "../../e2e/fixtures/run";
const {ledger} = vi.hoisted(() => ({ledger: vi.fn()}));
vi.mock("../../scripts/e2e/hosted-resources.mjs", () => ({recordResource: ledger}));
import {isSessionCookie, observationDeadline, bearerClaims, importProject} from "../../e2e/fixtures/hosted-personas";

describe("hosted persona safety helpers", () => {
  it("recognizes loopback, HTTPS secure/host prefixes and chunks", () => {
    for (const name of ["authjs.session-token", "authjs.session-token.0", "__Secure-authjs.session-token", "__Secure-authjs.session-token.12", "__Host-authjs.session-token.0"]) expect(isSessionCookie(name)).toBe(true);
    for (const name of ["authjs.csrf-token", "other-authjs.session-token", "authjs.session-token.x", "authjs.session-token.0.extra"]) expect(isSessionCookie(name)).toBe(false);
  });
  it("observes only future boundaries with a complete recovery margin inside the budget", () => {
    expect(observationDeadline(20_000, 100_000, 10_000)).toBe(25_000);
    expect(observationDeadline(20_000, 80_000, 10_000)).toBeNull();
    expect(observationDeadline(9_000, 100_000, 10_000)).toBeNull();
    expect(observationDeadline(Number.NaN, 100_000, 10_000)).toBeNull();
  });
  it("extracts only usable JWT timing and subject claims without exposing a malformed token", () => {
    const token = `x.${Buffer.from(JSON.stringify({sub: "synthetic", iat: 10, exp: 20, secret: "ignore"})).toString("base64url")}.x`;
    expect(bearerClaims(token)).toEqual({sub: "synthetic", iat: 10, exp: 20});
    expect(() => bearerClaims("SENTINEL-PRIVATE-TOKEN")).toThrow("HOSTED_BEARER_CLAIMS");
    expect(() => bearerClaims("SENTINEL-PRIVATE-TOKEN")).not.toThrow(/SENTINEL/);
  });
});


describe("hosted project retention", () => {
  beforeEach(() => { ledger.mockReset(); });
  const run = {id: "synthetic-run", hosted: {retain: true}, web: "https://web.example.test", api: "https://api.example.test", users: {owner: {id: "synthetic-owner"}}} as unknown as SuggestionsRunConfig;
  function pageFor(events: string[], status = 201) {
    return {request: {
      get: vi.fn(async () => ({status: () => 200, json: async () => ({user: {id: "synthetic-owner"}, accessToken: "synthetic-bearer"})})),
      fetch: vi.fn(async () => { events.push("import"); return {status: () => status, json: async () => ({id: "00000000-0000-4000-8000-000000000001"})}; }),
    }} as unknown as Page;
  }
  it("persists intent before import and returned ownership before validating success", async () => {
    const events: string[] = [];
    ledger.mockImplementation(async (_run, entry) => { events.push(entry.event); });
    await expect(importProject(pageFor(events, 500), run, true)).rejects.toThrow("HOSTED_PROJECT_IMPORT");
    expect(events).toEqual(["project-import-intent", "import", "project-created"]);
    expect(ledger.mock.calls[1][1]).toMatchObject({id: "00000000-0000-4000-8000-000000000001", disposition: "retained"});
  });
  it("does not send an import when its durable intent cannot be recorded", async () => {
    const events: string[] = [];
    ledger.mockRejectedValue(new Error("synthetic ledger unavailable"));
    const page = pageFor(events);
    await expect(importProject(page, run, false)).rejects.toThrow("synthetic ledger unavailable");
    expect(page.request.fetch).not.toHaveBeenCalled();
  });
});

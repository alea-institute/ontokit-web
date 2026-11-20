import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { mockFetch, mockOk, resetFetch } from "@/__tests__/helpers/mockFetch";
import { changesApi, type OriginChangeEvent } from "@/lib/api/changes";

describe("changesApi", () => {
  beforeEach(resetFetch);

  it("serializes the feed window, repeated filters and an opaque cursor", async () => {
    mockOk({ items: [], next_cursor: null });

    await changesApi.list("project-1", undefined, {
      days: 30,
      branch: "review/working",
      origin: ["ai", "ai_edited"],
      author: ["user-1", "user-2"],
      entity_type: ["class", "individual", "property"],
      event_type: ["create", "update"],
      limit: 25,
      cursor: "next+/=",
    });

    const [input, init] = mockFetch.mock.calls[0];
    const { pathname, searchParams } = new URL(input);
    expect(pathname).toBe("/api/v1/projects/project-1/analytics/changes");
    expect([...searchParams]).toEqual([
      ["days", "30"], ["branch", "review/working"],
      ["origin", "ai"], ["origin", "ai_edited"],
      ["author", "user-1"], ["author", "user-2"],
      ["entity_type", "class"], ["entity_type", "individual"], ["entity_type", "property"],
      ["event_type", "create"], ["event_type", "update"],
      ["limit", "25"], ["cursor", "next+/="],
    ]);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("types nullable event metadata and the required actor ID as returned by the feed", () => {
    expectTypeOf<OriginChangeEvent["user_id"]>().toEqualTypeOf<string>();
    expectTypeOf<OriginChangeEvent["commit_hash"]>().toEqualTypeOf<string | null>();
    expectTypeOf<OriginChangeEvent["old_values"]>().toEqualTypeOf<Record<string, unknown> | null>();
    expectTypeOf<OriginChangeEvent["new_values"]>().toEqualTypeOf<Record<string, unknown> | null>();
  });

  it("reads the lighter marker feed with the selected window and origins", async () => {
    const response = { items: [], truncated: true };
    mockOk(response);

    expect(await changesApi.listChangedEntities("project-1", undefined, {
      days: 90,
      origin: ["ai", "system"],
    })).toEqual(response);

    const [input] = mockFetch.mock.calls[0];
    const { pathname, searchParams } = new URL(input);
    expect(pathname).toBe("/api/v1/projects/project-1/analytics/changed-entities");
    expect([...searchParams]).toEqual([["days", "90"], ["origin", "ai"], ["origin", "system"]]);
  });

  it("sends only query parameters supported by each endpoint", async () => {
    const filters = { days: 7, author: ["user-1"], net_change: ["transient"] };
    mockOk({ items: [], next_cursor: null });
    await changesApi.list("project-1", undefined, filters);
    mockOk({ items: [], truncated: false });
    await changesApi.listChangedEntities("project-1", undefined, filters);

    const urls = mockFetch.mock.calls.map(([input]) => new URL(input).searchParams);
    expect([...urls[0]]).toEqual([["days", "7"], ["author", "user-1"]]);
    expect([...urls[1]]).toEqual([["days", "7"]]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { mockFetch, mockOk, resetFetch } from "@/__tests__/helpers/mockFetch";
import { changesApi } from "@/lib/api/changes";

describe("changesApi", () => {
  beforeEach(resetFetch);

  it("serializes the feed window, repeated filters and an opaque cursor", async () => {
    mockOk({ items: [], next_cursor: null });

    await changesApi.list("project-1", undefined, {
      days: 30,
      branch: "review/working",
      origin: ["ai", "ai_edited"],
      author: ["user-1", "user-2"],
      entity_type: ["class", "individual"],
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
      ["entity_type", "class"], ["entity_type", "individual"],
      ["event_type", "create"], ["event_type", "update"],
      ["limit", "25"], ["cursor", "next+/="],
    ]);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
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
});

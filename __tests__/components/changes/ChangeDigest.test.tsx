import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeDigest, summarizeChangedEntities } from "@/components/changes/ChangeDigest";
import type { ChangedEntitiesResponse, ChangeOrigin, NetChange } from "@/lib/api/changes";

type Item = ChangedEntitiesResponse["items"][number];
let next = 0;
function entity(net_change: NetChange, ...origins: ChangeOrigin[]): Item {
  next += 1;
  return { entity_iri: `https://example.org/onto#E${next}`, net_change, origins, last_changed_at: "2026-11-19T18:30:00Z" };
}

const week: Item[] = [
  entity("added", "ai"), entity("added", "ai"), entity("added", "ai_edited"),
  entity("added", "ai", "human"),
  entity("transient", "ai", "human"),
  entity("added", "human"), entity("modified", "human"), entity("removed", "human"),
  entity("added", "system"),
];

afterEach(cleanup);

describe("summarizeChangedEntities", () => {
  it("separates what AI added from what people changed", () => {
    expect(summarizeChangedEntities(week)).toEqual({
      ai: { added: 4, asSuggested: 3, edited: 1, removedSince: 1 },
      people: { total: 5, added: 1, modified: 2, removed: 2, transient: 0 },
      system: 1,
    });
  });

  it("counts a person's edit to an AI-added class as a modification, not a second addition", () => {
    const { ai, people } = summarizeChangedEntities([entity("added", "ai", "human")]);
    expect(ai.added).toBe(1);
    expect(people).toMatchObject({ total: 1, added: 0, modified: 1 });
  });

  it("credits people only with their own part of an entity that an import or AI created", () => {
    const { people, system } = summarizeChangedEntities([
      entity("added", "system", "human"),
      entity("transient", "system", "human"),
      entity("transient", "human"),
    ]);
    expect(people).toEqual({ total: 3, added: 0, modified: 1, removed: 1, transient: 1 });
    expect(system).toBe(0);
  });
});

describe("ChangeDigest", () => {
  function mount(props: Partial<Parameters<typeof ChangeDigest>[0]> = {}) {
    const onShow = vi.fn();
    render(<ChangeDigest days={7} items={week} truncated={false} isLoading={false} origins={[]} onShow={onShow} {...props} />);
    return { onShow, region: screen.getByRole("region", { name: /at a glance$/ }) };
  }

  it("answers what AI added and what people changed, in words and numbers", () => {
    const { region } = mount();
    const ai = within(region).getByRole("button", { name: /4 classes added by AI/ });
    expect(ai.textContent).toContain("3 accepted as suggested, 1 edited before accepting");
    expect(ai.textContent).toContain("1 more added by AI, then removed");
    const people = within(region).getByRole("button", { name: /5 entities changed by people/ });
    expect(people.textContent).toContain("1 added, 2 modified, 2 removed");
    expect(within(region).getByText(/1 entity changed by sync or import/)).toBeDefined();
  });

  it("filters the list from a tile and shows which tile is active", () => {
    const { onShow, region } = mount({ origins: ["human"] });
    const ai = within(region).getByRole("button", { name: /added by AI/ });
    const people = within(region).getByRole("button", { name: /changed by people/ });
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(people.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(ai);
    expect(onShow).toHaveBeenCalledWith(["ai", "ai_edited"]);
    fireEvent.click(people);
    expect(onShow).toHaveBeenLastCalledWith([]);
  });

  it("says so plainly when AI added nothing, and offers no empty filter", () => {
    const { region } = mount({ items: [entity("modified", "human")] });
    expect(within(region).getByText("No AI suggestions were accepted in this window.")).toBeDefined();
    expect(within(region).queryByRole("button", { name: /added by AI/ })).toBeNull();
    expect(within(region).getByRole("button", { name: /1 entity changed by people/ })).toBeDefined();
  });

  it("names the 24-hour window and flags counts cut off at the feed's cap", () => {
    mount({ days: 1, truncated: true });
    const region = screen.getByRole("region", { name: "Last 24 hours at a glance" });
    expect(within(region).getByText("Counts cover the 5,000 most recently changed entities.")).toBeDefined();
  });

  it("holds its place while loading and stays out of the way when counts are unavailable", () => {
    const { region } = mount({ items: undefined, isLoading: true });
    expect(region.getAttribute("aria-busy")).toBe("true");
    cleanup();
    render(<ChangeDigest days={7} items={undefined} truncated={false} isLoading={false} origins={[]} onShow={vi.fn()} />);
    expect(screen.queryByRole("region", { name: /at a glance/ })).toBeNull();
  });
});

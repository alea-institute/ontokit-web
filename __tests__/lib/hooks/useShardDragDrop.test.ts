import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";

// Mock @dnd-kit/core sensors (hooks are not testable directly in unit test env)
vi.mock("@dnd-kit/core", () => ({
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...args: unknown[]) => args),
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
}));

// Mock the store
const mockMoveEntity = vi.fn();
const mockMoveShard = vi.fn();

vi.mock("@/lib/stores/shardPreviewStore", () => ({
  useShardPreviewStore: (
    selector: (s: { moveEntity: typeof mockMoveEntity; moveShard: typeof mockMoveShard }) => unknown,
  ) => selector({ moveEntity: mockMoveEntity, moveShard: mockMoveShard }),
}));

// Import AFTER mocks
import { useShardDragDrop } from "@/lib/hooks/useShardDragDrop";

// Helper to build a minimal DragEndEvent
function makeDragEnd(
  activeId: string,
  activeData: Record<string, unknown> | undefined,
  overId: string | null,
): DragEndEvent {
  return {
    active: {
      id: activeId,
      data: { current: activeData },
      rect: { current: { initial: null, translated: null } },
    },
    over:
      overId != null
        ? {
            id: overId,
            data: { current: {} },
            rect: { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 },
          }
        : null,
    delta: { x: 0, y: 0 },
    activatorEvent: new Event("pointerdown"),
    collisions: [],
  } as unknown as DragEndEvent;
}

describe("useShardDragDrop", () => {
  beforeEach(() => {
    mockMoveEntity.mockClear();
    mockMoveShard.mockClear();
  });

  // CLUSTER-06: drag entity between shards
  it("handleDragEnd with entity type calls moveEntity on store", () => {
    const { result } = renderHook(() => useShardDragDrop());

    const event = makeDragEnd(
      "entity-iri:Foo-shard-1",
      { type: "entity", entityIri: "iri:Foo", fromShardId: "shard-1" },
      "shard-2",
    );

    result.current.handleDragEnd(event);

    expect(mockMoveEntity).toHaveBeenCalledOnce();
    expect(mockMoveEntity).toHaveBeenCalledWith("iri:Foo", "shard-1", "shard-2");
    expect(mockMoveShard).not.toHaveBeenCalled();
  });

  // CLUSTER-06: drag shard between PR groups
  it("handleDragEnd with shard type calls moveShard on store", () => {
    const { result } = renderHook(() => useShardDragDrop());

    const event = makeDragEnd(
      "shard-1",
      { type: "shard", shardId: "shard-1", fromPrId: "pr-A" },
      "pr-B",
    );

    result.current.handleDragEnd(event);

    expect(mockMoveShard).toHaveBeenCalledOnce();
    expect(mockMoveShard).toHaveBeenCalledWith("shard-1", "pr-A", "pr-B");
    expect(mockMoveEntity).not.toHaveBeenCalled();
  });

  // Invalid drop target
  it("handleDragEnd with no over target does nothing", () => {
    const { result } = renderHook(() => useShardDragDrop());

    const event = makeDragEnd(
      "entity-iri:Foo-shard-1",
      { type: "entity", entityIri: "iri:Foo", fromShardId: "shard-1" },
      null,
    );

    result.current.handleDragEnd(event);

    expect(mockMoveEntity).not.toHaveBeenCalled();
    expect(mockMoveShard).not.toHaveBeenCalled();
  });

  // Same-source no-op for entity
  it("handleDragEnd with entity dropped on same shard does nothing", () => {
    const { result } = renderHook(() => useShardDragDrop());

    const event = makeDragEnd(
      "entity-iri:Foo-shard-1",
      { type: "entity", entityIri: "iri:Foo", fromShardId: "shard-1" },
      "shard-1",
    );

    result.current.handleDragEnd(event);

    expect(mockMoveEntity).not.toHaveBeenCalled();
    expect(mockMoveShard).not.toHaveBeenCalled();
  });

  // Same-source no-op for shard
  it("handleDragEnd with shard dropped on same PR group does nothing", () => {
    const { result } = renderHook(() => useShardDragDrop());

    const event = makeDragEnd(
      "shard-1",
      { type: "shard", shardId: "shard-1", fromPrId: "pr-A" },
      "pr-A",
    );

    result.current.handleDragEnd(event);

    expect(mockMoveEntity).not.toHaveBeenCalled();
    expect(mockMoveShard).not.toHaveBeenCalled();
  });
});

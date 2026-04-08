import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShardTabNavigator } from "@/components/suggestions/ShardTabNavigator";

const shards = [
  { id: "shard-1", label: "Financial Crimes", entityCount: 12 },
  { id: "shard-2", label: "Corporate Law", entityCount: 5 },
];

describe("ShardTabNavigator", () => {
  it("renders 'All' tab as the first tab", () => {
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={vi.fn()}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].textContent).toMatch(/All/);
  });

  it("renders one tab per shard with the shard label", () => {
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Financial Crimes")).toBeTruthy();
    expect(screen.getByText("Corporate Law")).toBeTruthy();
  });

  it("each shard tab shows entity count badge", () => {
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={vi.fn()}
      />,
    );
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("'All' tab is active by default (aria-selected=true)", () => {
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={vi.fn()}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("clicking a shard tab calls onShardChange with shard id", () => {
    const onShardChange = vi.fn();
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={onShardChange}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]); // "Financial Crimes"
    expect(onShardChange).toHaveBeenCalledWith("shard-1");
  });

  it("clicking 'All' tab calls onShardChange with null", () => {
    const onShardChange = vi.fn();
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId="shard-1"
        onShardChange={onShardChange}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[0]);
    expect(onShardChange).toHaveBeenCalledWith(null);
  });

  it("active shard tab has the primary border-b-2 styling class", () => {
    const { container } = render(
      <ShardTabNavigator
        shards={shards}
        activeShardId="shard-1"
        onShardChange={vi.fn()}
      />,
    );
    const tabs = container.querySelectorAll('[role="tab"]');
    // tabs[0] = All, tabs[1] = shard-1 (active), tabs[2] = shard-2
    expect(tabs[1].className).toContain("border-b-2");
    expect(tabs[1].className).toContain("border-primary-500");
  });

  it("container has role='tablist'", () => {
    render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        onShardChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("tablist")).toBeTruthy();
  });

  it("shard mark indicator dot renders green for approved, red for rejected", () => {
    const { container } = render(
      <ShardTabNavigator
        shards={shards}
        activeShardId={null}
        shardMarks={{ "shard-1": "approved", "shard-2": "rejected" }}
        onShardChange={vi.fn()}
      />,
    );
    const greenDots = container.querySelectorAll(".bg-green-500");
    const redDots = container.querySelectorAll(".bg-red-500");
    expect(greenDots.length).toBeGreaterThan(0);
    expect(redDots.length).toBeGreaterThan(0);
  });
});

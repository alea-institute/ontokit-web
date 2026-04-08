import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShardReviewMarker } from "@/components/suggestions/ShardReviewMarker";

describe("ShardReviewMarker", () => {
  it("Test 1: Renders 'Approve shard' and 'Reject shard' buttons when no mark is set", () => {
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Approve shard")).toBeDefined();
    expect(screen.getByText("Reject shard")).toBeDefined();
  });

  it("Test 2: Clicking 'Approve shard' calls onChange with { status: 'approved' }", () => {
    const onChange = vi.fn();
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Approve shard"));
    expect(onChange).toHaveBeenCalledWith("shard-1", { status: "approved" });
  });

  it("Test 3: Clicking 'Reject shard' calls onChange with { status: 'rejected', feedback: '' }", () => {
    const onChange = vi.fn();
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Reject shard"));
    expect(onChange).toHaveBeenCalledWith("shard-1", { status: "rejected", feedback: "" });
  });

  it("Test 4: When mark is 'approved', shows 'Shard approved' text and a 'Clear' button", () => {
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        mark={{ status: "approved" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Shard approved")).toBeDefined();
    expect(screen.getByText("Clear")).toBeDefined();
    // Approve/Reject buttons should NOT be present
    expect(screen.queryByText("Approve shard")).toBeNull();
    expect(screen.queryByText("Reject shard")).toBeNull();
  });

  it("Test 5: When mark is 'rejected', shows 'Shard rejected' text and a feedback textarea", () => {
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        mark={{ status: "rejected", feedback: "" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Shard rejected")).toBeDefined();
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("Test 6: Clicking 'Clear' on approved state calls onChange with undefined", () => {
    const onChange = vi.fn();
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        mark={{ status: "approved" }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith("shard-1", undefined);
  });

  it("Test 7: Typing in the rejected feedback textarea calls onChange with updated feedback", () => {
    const onChange = vi.fn();
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        mark={{ status: "rejected", feedback: "" }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Please fix the naming conventions." },
    });
    expect(onChange).toHaveBeenCalledWith("shard-1", {
      status: "rejected",
      feedback: "Please fix the naming conventions.",
    });
  });

  it("Test 8: Approved state has role='status' and aria-live='polite'", () => {
    render(
      <ShardReviewMarker
        shardId="shard-1"
        shardLabel="Financial Crimes"
        mark={{ status: "approved" }}
        onChange={vi.fn()}
      />
    );
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeDefined();
    expect(statusEl.getAttribute("aria-live")).toBe("polite");
  });
});

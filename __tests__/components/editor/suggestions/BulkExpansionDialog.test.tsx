import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkExpansionDialog } from "@/components/editor/suggestions/BulkExpansionDialog";

const targets = Array.from({ length: 12 }, (_, i) => ({ iri: `https://example.org/Class${i + 1}`, label: `Class ${i + 1}` }));

describe("BulkExpansionDialog", () => {
  function mount() {
    const generate = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Tree node</button>
          {open && (
            <BulkExpansionDialog targets={targets} onCancel={() => setOpen(false)}
              returnFocus={() => screen.getByRole("button", { name: "Tree node" }).focus()} onGenerate={generate} />
          )}
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Tree node" }));
    return { generate, dialog: within(screen.getByRole("dialog")) };
  }

  it("checks only the first ten, allows swapping targets, and confirms the request count and size", () => {
    const { generate, dialog } = mount();
    expect(dialog.getByText(/first 10/i)).toBeDefined();
    const checkboxes = dialog.getAllByRole<HTMLInputElement>("checkbox");
    expect(checkboxes.filter((box) => box.checked)).toHaveLength(10);
    expect(checkboxes[10].disabled).toBe(true);
    fireEvent.click(dialog.getByRole("checkbox", { name: "Class 1" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "Class 11" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "Class 3" }));
    fireEvent.change(dialog.getByLabelText("Suggestions per class"), { target: { value: "10" } });
    expect(dialog.getByText("This makes 9 AI requests, one per class, counted against your daily limit and the project budget.")).toBeDefined();
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Generate for 9 classes" }));
    expect(generate).toHaveBeenCalledExactlyOnceWith(targets.slice(1, 11).filter(({ label }) => label !== "Class 3"), 10);
  });

  it("returns focus to the invoking node on Cancel", async () => {
    const { generate, dialog } = mount();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tree node" })));
    expect(generate).not.toHaveBeenCalled();
  });
});

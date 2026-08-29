import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SourceRevisionConflictBanner } from "@/components/editor/SourceRevisionConflictBanner";

describe("SourceRevisionConflictBanner", () => {
  const conflict = {
    detail: {
      code: "SOURCE_REVISION_CONFLICT" as const,
      message: "The source changed on the server.",
      base_revision: "base",
      current_revision: "current",
      branch: "main",
    },
    draftContent: "local draft",
  };

  it("requires confirmation before discarding the preserved draft", async () => {
    const user = userEvent.setup();
    const onLoadLatest = vi.fn().mockResolvedValue(undefined);
    render(<SourceRevisionConflictBanner
      conflict={conflict}
      isLoadingLatest={false}
      onLoadLatest={onLoadLatest}
    />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/draft is preserved/i);
    expect(alert.textContent).toMatch(/load latest/i);
    await user.click(screen.getByRole("button", { name: /^load latest$/i }));
    expect(onLoadLatest).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/preserved local draft will be discarded/i);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onLoadLatest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^load latest$/i }));
    await user.click(screen.getByRole("button", { name: /discard draft and load latest/i }));
    expect(onLoadLatest).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmation open when loading latest fails", async () => {
    const user = userEvent.setup();
    const onLoadLatest = vi.fn().mockRejectedValue(new Error("Latest source is unavailable"));
    render(<SourceRevisionConflictBanner
      conflict={conflict}
      isLoadingLatest={false}
      onLoadLatest={onLoadLatest}
    />);

    await user.click(screen.getByRole("button", { name: /^load latest$/i }));
    await user.click(screen.getByRole("button", { name: /discard draft and load latest/i }));

    expect(await screen.findByText("Latest source is unavailable")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/draft is preserved/i);
  });
});

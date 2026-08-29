import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SourceRevisionConflictBanner } from "@/components/editor/SourceRevisionConflictBanner";

describe("SourceRevisionConflictBanner", () => {
  it("announces that the draft is preserved and requires an explicit load-latest action", async () => {
    const onLoadLatest = vi.fn().mockResolvedValue(undefined);
    render(<SourceRevisionConflictBanner
      conflict={{
        detail: {
          code: "SOURCE_REVISION_CONFLICT",
          message: "The source changed on the server.",
          base_revision: "base",
          current_revision: "current",
          branch: "main",
        },
        draftContent: "local draft",
      }}
      isLoadingLatest={false}
      onLoadLatest={onLoadLatest}
    />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/draft is preserved/i);
    expect(alert.textContent).toMatch(/load latest/i);
    await userEvent.click(screen.getByRole("button", { name: /load latest/i }));
    expect(onLoadLatest).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const announceMock = vi.fn();
vi.mock("@/components/ui/ScreenReaderAnnouncer", () => ({
  useAnnounce: () => ({ announce: announceMock }),
}));

import { LLMBudgetBanner } from "@/components/editor/LLMBudgetBanner";

beforeEach(() => {
  announceMock.mockClear();
});

describe("LLMBudgetBanner", () => {
  it("renders nothing below the 80% warning threshold", () => {
    const { container } = render(
      <LLMBudgetBanner
        budgetExhausted={false}
        monthlySpentUsd={50}
        monthlyBudgetUsd={100}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when budget is unlimited (null)", () => {
    const { container } = render(
      <LLMBudgetBanner
        budgetExhausted={false}
        monthlySpentUsd={5000}
        monthlyBudgetUsd={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a warning with percent used and remaining dollars at 80-99%", () => {
    render(
      <LLMBudgetBanner
        budgetExhausted={false}
        monthlySpentUsd={85}
        monthlyBudgetUsd={100}
      />
    );
    expect(
      screen.getByText(/AI budget 85% used this month/)
    ).toBeTruthy();
    expect(screen.getByText(/\$15\.00 remaining/)).toBeTruthy();
    // Warning is informational, not an alert
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the exhausted alert when budgetExhausted is true", () => {
    render(
      <LLMBudgetBanner
        budgetExhausted={true}
        monthlySpentUsd={100}
        monthlyBudgetUsd={100}
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/AI budget exhausted for this month/);
    expect(alert.textContent).toMatch(/Manual suggestions continue to work/);
  });

  it("announces exhaustion assertively for screen readers", () => {
    render(
      <LLMBudgetBanner
        budgetExhausted={true}
        monthlySpentUsd={100}
        monthlyBudgetUsd={100}
      />
    );
    expect(announceMock).toHaveBeenCalledWith(
      "AI budget exhausted for this month. LLM features are disabled.",
      "assertive"
    );
  });

  it("hides after dismiss", async () => {
    const user = userEvent.setup();
    render(
      <LLMBudgetBanner
        budgetExhausted={true}
        monthlySpentUsd={100}
        monthlyBudgetUsd={100}
      />
    );
    await user.click(
      screen.getByRole("button", { name: "Dismiss budget warning" })
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("re-shows after dismissal when the exhaustion state changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LLMBudgetBanner
        budgetExhausted={false}
        monthlySpentUsd={85}
        monthlyBudgetUsd={100}
      />
    );
    await user.click(
      screen.getByRole("button", { name: "Dismiss budget warning" })
    );
    expect(screen.queryByText(/AI budget/)).toBeNull();

    // New exhaustion event resets the dismissal
    rerender(
      <LLMBudgetBanner
        budgetExhausted={true}
        monthlySpentUsd={100}
        monthlyBudgetUsd={100}
      />
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

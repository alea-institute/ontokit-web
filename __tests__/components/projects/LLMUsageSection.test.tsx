import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LLMUsageSection } from "@/components/projects/LLMUsageSection";
import type {
  LLMConfigResponse,
  LLMUsageResponse,
  LLMUserUsage,
} from "@/lib/api/llm";

const hookState = vi.hoisted(() => ({
  usage: undefined as LLMUsageResponse | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  config: null as LLMConfigResponse | null,
}));

vi.mock("@/lib/hooks/useLLMUsage", () => ({
  useLLMUsage: () => ({
    usage: hookState.usage,
    isLoading: hookState.isLoading,
    error: hookState.error,
    refetch: hookState.refetch,
  }),
}));

vi.mock("@/lib/hooks/useLLMConfig", () => ({
  useLLMConfig: () => ({ config: hookState.config }),
}));

function userUsage(
  userId: string,
  callsThisMonth: number,
  overrides: Partial<LLMUserUsage> = {},
): LLMUserUsage {
  return {
    user_id: userId,
    user_name: userId,
    calls_today: 1,
    calls_this_month: callsThisMonth,
    cost_this_month_usd: callsThisMonth / 10,
    is_byo_key: false,
    ...overrides,
  };
}

function usage(overrides: Partial<LLMUsageResponse> = {}): LLMUsageResponse {
  return {
    total_calls: 0,
    total_cost_usd: 0,
    budget_consumed_pct: null,
    burn_rate_daily_usd: 0,
    users: [],
    ...overrides,
  };
}

function config(monthlyBudgetUsd: number | null): LLMConfigResponse {
  return {
    provider: "openai",
    model: "gpt-5-mini",
    model_tier: "cheap",
    api_key_set: true,
    base_url: null,
    monthly_budget_usd: monthlyBudgetUsd,
    daily_cap_usd: null,
  };
}

describe("LLMUsageSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.usage = undefined;
    hookState.isLoading = false;
    hookState.error = null;
    hookState.config = null;
    hookState.refetch.mockResolvedValue(undefined);
  });

  it("renders distinct loading, error, and no-usage states", () => {
    hookState.isLoading = true;
    const { container, rerender } = render(
      <LLMUsageSection projectId="project-1" accessToken="token" />,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText(/failed to load usage data/i)).toBeNull();

    hookState.isLoading = false;
    hookState.error = new Error("usage unavailable");
    rerender(<LLMUsageSection projectId="project-1" accessToken="token" />);
    expect(screen.getByText(/failed to load usage data/i)).toBeDefined();

    hookState.error = null;
    rerender(<LLMUsageSection projectId="project-1" accessToken="token" />);
    expect(screen.getByText(/no LLM calls recorded this month/i)).toBeDefined();
  });

  it("uses the configured budget as the remaining-balance fallback", () => {
    hookState.config = config(100);
    hookState.usage = usage({
      total_cost_usd: 25,
      burn_rate_daily_usd: 2.5,
    });

    render(<LLMUsageSection projectId="project-1" accessToken="token" />);

    expect(screen.getByText("$75.00").className).toContain("text-green-600");
    expect(screen.getByText("~$2.50/day")).toBeDefined();
  });

  it("clamps exhausted budgets to a red zero balance", () => {
    hookState.config = config(20);
    hookState.usage = usage({ total_cost_usd: 25 });

    render(<LLMUsageSection projectId="project-1" accessToken="token" />);

    expect(screen.getByText("$0.00").className).toContain("text-red-600");
  });

  it("uses primary, amber, and red progress colors at budget thresholds", () => {
    hookState.usage = usage({ budget_consumed_pct: 0.79 });
    const { container, rerender } = render(
      <LLMUsageSection projectId="project-1" accessToken="token" />,
    );

    expect(container.querySelector(".bg-primary-500")).not.toBeNull();
    expect(screen.getByText("79% of monthly budget used")).toBeDefined();

    hookState.usage = usage({ budget_consumed_pct: 0.8 });
    rerender(<LLMUsageSection projectId="project-1" accessToken="token" />);
    expect(container.querySelector(".bg-amber-500")).not.toBeNull();

    hookState.usage = usage({ budget_consumed_pct: 1 });
    rerender(<LLMUsageSection projectId="project-1" accessToken="token" />);
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
    expect(screen.getByText("100% of monthly budget used")).toBeDefined();
  });

  it("orders users by monthly calls and preserves their usage details", () => {
    hookState.usage = usage({
      users: [
        userUsage("Grace", 3),
        userUsage("Ada", 12, { calls_today: 4, is_byo_key: true }),
        userUsage("Linus", 7),
      ],
    });

    render(<LLMUsageSection projectId="project-1" accessToken="token" />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "Ada",
      "Linus",
      "Grace",
    ]);
    expect(within(rows[0]).getByText("4")).toBeDefined();
    expect(within(rows[0]).getByLabelText("Uses BYO key")).toBeDefined();
  });

  it("refreshes usage on demand", async () => {
    const user = userEvent.setup();
    hookState.usage = usage();
    render(<LLMUsageSection projectId="project-1" accessToken="token" />);

    await user.click(screen.getByRole("button", { name: /refresh usage data/i }));

    expect(hookState.refetch).toHaveBeenCalledTimes(1);
  });

  it("paginates more than 20 users in sorted order", async () => {
    const user = userEvent.setup();
    hookState.usage = usage({
      users: Array.from({ length: 21 }, (_, index) =>
        userUsage(`User ${String(index + 1).padStart(2, "0")}`, 21 - index),
      ),
    });
    render(<LLMUsageSection projectId="project-1" accessToken="token" />);

    expect(screen.getByText(/Showing 1–20 of 21 users/)).toBeDefined();
    expect(screen.getByText("User 01")).toBeDefined();
    expect(screen.queryByText("User 21")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Showing 21–21 of 21 users/)).toBeDefined();
    expect(screen.getByText("User 21")).toBeDefined();
    expect(screen.queryByText("User 01")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("User 01")).toBeDefined();
  });

  it("does not strand the table on an empty page when refreshed data shrinks", async () => {
    const user = userEvent.setup();
    hookState.usage = usage({
      users: Array.from({ length: 21 }, (_, index) =>
        userUsage(`User ${String(index + 1).padStart(2, "0")}`, 21 - index),
      ),
    });
    const { rerender } = render(
      <LLMUsageSection projectId="project-1" accessToken="token" />,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("User 21")).toBeDefined();

    hookState.usage = usage({ users: [userUsage("Only user", 5)] });
    rerender(<LLMUsageSection projectId="project-1" accessToken="token" />);

    expect(screen.getByText("Only user")).toBeDefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrustLadderSection, trustSettingsQueryKeys } from "@/components/projects/TrustLadderSection";
import type { ProjectTrustSettings, ProjectTrustSettingsUpdate } from "@/lib/api/trust";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

let settings: ProjectTrustSettings;
let updates: ProjectTrustSettingsUpdate[];
let rejected: boolean;
beforeEach(() => {
  settings = { trust_promotion_threshold: 5, auto_accept_enabled: false, auto_accept_quiet_days: 7 };
  updates = []; rejected = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(new URL(String(input)).pathname).toBe("/api/v1/projects/trust-project/trust/settings");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    if (init?.method === "PATCH") {
      const update = JSON.parse(String(init.body)) as ProjectTrustSettingsUpdate;
      updates.push(update);
      if (rejected) return jsonResponse({ detail: "Quiet period refused" }, 422);
      settings = { ...settings, ...update };
    } else expect(init?.method).toBe("GET");
    return jsonResponse(settings);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount() {
  const { client, wrapper } = llmHookHarness();
  render(<TrustLadderSection projectId="trust-project" accessToken="test-token" canManage />, { wrapper });
  return client;
}
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save trust settings" }));

describe("trust ladder settings through the real API and query cache", () => {
  it.each([1, 90])("saves a %i day quiet period and exposes the server result to other cache consumers", async days => {
    const client = mount();
    const quiet = await screen.findByLabelText("Quiet period (days)") as HTMLInputElement;
    expect(quiet.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(quiet, { target: { value: String(days) } });
    save();
    await screen.findByText("Saved");
    expect(updates).toEqual([{ auto_accept_enabled: true, auto_accept_quiet_days: days }]);
    expect(client.getQueryData(trustSettingsQueryKeys.detail("trust-project"))).toEqual({
      trust_promotion_threshold: 5, auto_accept_enabled: true, auto_accept_quiet_days: days,
    });
    expect((screen.getByRole("button", { name: "Save trust settings" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    save();
    await waitFor(() => expect(updates).toHaveLength(2));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save trust settings" }) as HTMLButtonElement).disabled).toBe(true));
    expect(updates[1]).toEqual({ auto_accept_enabled: false });
    expect(quiet.disabled).toBe(true);
    expect(quiet.value).toBe(String(days));
  });

  it("keeps rejected quiet-period edits and retries them without changing untouched settings", async () => {
    settings.auto_accept_enabled = true;
    rejected = true;
    mount();
    const quiet = await screen.findByLabelText("Quiet period (days)") as HTMLInputElement;
    fireEvent.change(quiet, { target: { value: "14" } });
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save the trust settings.");
    expect(quiet.value).toBe("14");
    expect(screen.queryByText("Saved")).toBeNull();
    rejected = false;
    save();
    await screen.findByText("Saved");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(updates).toEqual([{ auto_accept_quiet_days: 14 }, { auto_accept_quiet_days: 14 }]);
  });
});

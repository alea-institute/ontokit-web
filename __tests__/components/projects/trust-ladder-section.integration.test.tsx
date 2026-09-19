import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrustLadderSection, trustSettingsQueryKeys } from "@/components/projects/TrustLadderSection";
import type { ProjectTrustSettings, ProjectTrustSettingsUpdate } from "@/lib/api/trust";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

let settings: ProjectTrustSettings;
let updates: ProjectTrustSettingsUpdate[];
let rejected: boolean;
let loadRejected: boolean;
let saveGate: Promise<void> | undefined;
beforeEach(() => {
  settings = { trust_promotion_threshold: 5, auto_accept_enabled: false, auto_accept_quiet_days: 7 };
  updates = []; rejected = false; loadRejected = false; saveGate = undefined;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(new URL(String(input)).pathname).toBe("/api/v1/projects/trust-project/trust/settings");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    if (init?.method === "PATCH") {
      const update = JSON.parse(String(init.body)) as ProjectTrustSettingsUpdate;
      updates.push(update);
      if (saveGate) await saveGate;
      if (rejected) return jsonResponse({ detail: "Quiet period refused" }, 422);
      settings = { ...settings, ...update };
    } else {
      expect(init?.method).toBe("GET");
      if (loadRejected) return jsonResponse({ detail: "Settings unavailable" }, 403);
    }
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

  it("preserves newer edits while the first save updates shared authoritative settings", async () => {
    let finish!: () => void;
    saveGate = new Promise<void>(resolve => { finish = resolve; });
    const client = mount();
    const threshold = await screen.findByLabelText("Accepted suggestions to become trusted") as HTMLInputElement;
    fireEvent.change(threshold, { target: { value: "10" } });
    save();
    await waitFor(() => expect(updates).toEqual([{ trust_promotion_threshold: 10 }]));
    fireEvent.change(threshold, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => { finish(); });
    await waitFor(() => expect(client.getQueryData(trustSettingsQueryKeys.detail("trust-project"))).toMatchObject({ trust_promotion_threshold: 10 }));
    expect(threshold.value).toBe("12");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(client.getQueryData(trustSettingsQueryKeys.detail("trust-project"))).toEqual({ trust_promotion_threshold: 10, auto_accept_enabled: false, auto_accept_quiet_days: 7 });
    expect((screen.getByRole("button", { name: "Save trust settings" }) as HTMLButtonElement).disabled).toBe(false);
    saveGate = undefined;
    save();
    await waitFor(() => expect(updates).toHaveLength(2));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save trust settings" }) as HTMLButtonElement).disabled).toBe(true));
    expect(updates[1]).toEqual({ trust_promotion_threshold: 12, auto_accept_enabled: true });
    expect(client.getQueryData(trustSettingsQueryKeys.detail("trust-project"))).toEqual({ trust_promotion_threshold: 12, auto_accept_enabled: true, auto_accept_quiet_days: 7 });
  });

  it("recovers an initial settings load failure through the real retry button", async () => {
    loadRejected = true;
    const client = mount();
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't load the contribution trust settings.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    loadRejected = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findByLabelText("Accepted suggestions to become trusted") as HTMLInputElement).value).toBe("5");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(client.getQueryData(trustSettingsQueryKeys.detail("trust-project"))).toEqual(settings);
    expect(updates).toEqual([]);
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

/**
 * U14 — per-project ladder configuration (R6, R11; KTD8).
 *
 * The consequential control here is auto-accept: switching it on means
 * trusted contributors' suggestions merge themselves. It ships off, and the
 * section has to keep saying so.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";
import type { ProjectTrustSettings } from "@/lib/api/trust";

vi.mock("@/lib/api/trust", () => ({
  trustApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

import { trustApi } from "@/lib/api/trust";
import { TrustLadderSection } from "@/components/projects/TrustLadderSection";

const mockedGet = trustApi.getSettings as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = trustApi.updateSettings as unknown as ReturnType<typeof vi.fn>;

function settings(overrides: Partial<ProjectTrustSettings> = {}): ProjectTrustSettings {
  return {
    trust_promotion_threshold: 5,
    auto_accept_enabled: false,
    auto_accept_quiet_days: 7,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGet.mockResolvedValue(settings());
});

describe("TrustLadderSection", () => {
  it("renders nothing for a member who cannot manage the project", () => {
    const { container } = renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage={false} />,
    );
    expect(container.innerHTML).toBe("");
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("shows the current threshold and an auto-accept switch that starts off", async () => {
    renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage />,
    );

    const threshold = (await screen.findByLabelText(
      /Accepted suggestions to become trusted/,
    )) as HTMLInputElement;
    expect(threshold.value).toBe("5");

    const autoAccept = screen.getByRole("checkbox", {
      name: /Merge trusted contributors' suggestions automatically/,
    }) as HTMLInputElement;
    expect(autoAccept.checked).toBe(false);

    // The quiet-period field is inert until auto-accept is on.
    expect((screen.getByLabelText(/Quiet period/) as HTMLInputElement).disabled).toBe(true);
  });

  it("says plainly that AI and untrusted work never auto-merges", async () => {
    renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage />,
    );
    expect(
      await screen.findByText(/never merged this way — they always wait for a\s+human/),
    ).toBeDefined();
  });

  it("saves only after an edit, and sends the whole settings object", async () => {
    const user = userEvent.setup();
    mockedUpdate.mockResolvedValue(settings({ auto_accept_enabled: true }));
    renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage />,
    );

    const save = (await screen.findByRole("button", {
      name: /Save trust settings/,
    })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.click(
      screen.getByRole("checkbox", {
        name: /Merge trusted contributors' suggestions automatically/,
      }),
    );
    expect((screen.getByLabelText(/Quiet period/) as HTMLInputElement).disabled).toBe(false);
    expect(save.disabled).toBe(false);

    await user.click(save);

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        "p1",
        {
          trust_promotion_threshold: 5,
          auto_accept_enabled: true,
          auto_accept_quiet_days: 7,
        },
        "tok",
      ),
    );
    expect(await screen.findByRole("status")).toBeDefined();
  });

  it("surfaces a load failure instead of showing empty controls", async () => {
    mockedGet.mockRejectedValue(new Error("nope"));
    renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage />,
    );
    expect(
      await screen.findByText(/Couldn't load the contribution trust settings/),
    ).toBeDefined();
  });

  it("reports a failed save rather than pretending it landed", async () => {
    const user = userEvent.setup();
    mockedUpdate.mockRejectedValue(new Error("nope"));
    renderWithQueryClient(
      <TrustLadderSection projectId="p1" accessToken="tok" canManage />,
    );

    await user.click(
      await screen.findByRole("checkbox", {
        name: /Merge trusted contributors' suggestions automatically/,
      }),
    );
    await user.click(screen.getByRole("button", { name: /Save trust settings/ }));

    expect(await screen.findByRole("alert")).toBeDefined();
  });
});

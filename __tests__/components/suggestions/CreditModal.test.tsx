import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Provide localStorage before the anonymousCreditStore module loads (Zustand
// persist captures it at import time) — CreditModal reads/writes credit info
// through useAnonymousCreditStore.
vi.hoisted(() => {
  if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

import { CreditModal } from "@/components/suggestions/CreditModal";
import { useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";

const mockOnSubmitCredit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAnonymousCreditStore.setState({ name: null, email: null });
  localStorage.clear();
});

describe("CreditModal", () => {
  it("does not render when closed", () => {
    render(<CreditModal open={false} onSubmitCredit={mockOnSubmitCredit} />);
    expect(screen.queryByText(/Want credit for your suggestions/)).toBeNull();
  });

  it("renders optional name and email fields when open (no numeric credit-count concept exists in this store)", () => {
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);
    expect(screen.getByText(/Want credit for your suggestions/)).toBeDefined();
    expect(screen.getByPlaceholderText("Your name")).toBeDefined();
    expect(screen.getByPlaceholderText("your@email.com")).toBeDefined();
  });

  it("pre-fills name/email from the persisted credit store on open", () => {
    useAnonymousCreditStore.getState().setCredit("Ada Lovelace", "ada@example.org");

    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Ada Lovelace");
    expect((screen.getByPlaceholderText("your@email.com") as HTMLInputElement).value).toBe("ada@example.org");
  });

  it("submits trimmed name/email with an empty honeypot, and caches them in the credit store", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    await user.type(screen.getByPlaceholderText("Your name"), "  Ada Lovelace  ");
    await user.type(screen.getByPlaceholderText("your@email.com"), "  ada@example.org  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockOnSubmitCredit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmitCredit).toHaveBeenCalledWith("Ada Lovelace", "ada@example.org", "");
    expect(useAnonymousCreditStore.getState().name).toBe("Ada Lovelace");
    expect(useAnonymousCreditStore.getState().email).toBe("ada@example.org");
  });

  it("submits null/null when both fields are left blank, without caching a credit entry", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockOnSubmitCredit).toHaveBeenCalledWith(null, null, "");
    expect(useAnonymousCreditStore.getState().name).toBeNull();
    expect(useAnonymousCreditStore.getState().email).toBeNull();
  });

  it("Skip submits null/null credit (the submit still happens — the modal is the submit gate)", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    await user.type(screen.getByPlaceholderText("Your name"), "Ada Lovelace");
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(mockOnSubmitCredit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmitCredit).toHaveBeenCalledWith(null, null, "");
    // Skipping must not cache anything either
    expect(useAnonymousCreditStore.getState().name).toBeNull();
  });

  it("renders the honeypot 'website' field starting empty and hidden from assistive tech (spam control)", () => {
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    // Dialog content is portaled to document.body, not the render() container
    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot?.value).toBe("");
    expect(honeypot?.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot?.tabIndex).toBe(-1);
  });

  it("forwards a filled honeypot VERBATIM to onSubmitCredit (server decides; client must not swallow the bot signal) and never caches bot input", async () => {
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    fireEvent.change(honeypot, { target: { value: "http://spam.example" } });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Your name"), "Bot Name");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Honeypot tripped -> submit STILL fires with the honeypot value attached
    // (the api silently fakes success server-side), but nothing is cached.
    expect(mockOnSubmitCredit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmitCredit).toHaveBeenCalledWith("Bot Name", null, "http://spam.example");
    expect(useAnonymousCreditStore.getState().name).toBeNull();
  });

  it("forwards the honeypot on Skip too (bots dismissing the modal still carry the signal)", async () => {
    render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    fireEvent.change(honeypot, { target: { value: "http://spam.example" } });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(mockOnSubmitCredit).toHaveBeenCalledWith(null, null, "http://spam.example");
  });

  it("resets the honeypot field to empty every time the modal re-opens", () => {
    const { rerender } = render(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    const honeypot = () => document.querySelector<HTMLInputElement>('input[name="website"]')!;
    fireEvent.change(honeypot(), { target: { value: "http://spam.example" } });
    expect(honeypot().value).toBe("http://spam.example");

    rerender(<CreditModal open={false} onSubmitCredit={mockOnSubmitCredit} />);
    rerender(<CreditModal open={true} onSubmitCredit={mockOnSubmitCredit} />);

    expect(honeypot().value).toBe("");
  });
});

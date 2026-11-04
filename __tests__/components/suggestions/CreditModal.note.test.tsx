import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreditModal, REVIEWER_NOTE_MAX_LENGTH } from "@/components/suggestions/CreditModal";
import { useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";

const onSubmitCredit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAnonymousCreditStore.setState({ name: null, email: null });
  localStorage.clear();
});

const noteField = () => screen.getByLabelText(/Note for the reviewers/) as HTMLTextAreaElement;

describe("CreditModal note for the reviewers", () => {
  it("renders a labelled, length-limited textarea with a live counter", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    const field = noteField();
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.maxLength).toBe(REVIEWER_NOTE_MAX_LENGTH);
    expect(REVIEWER_NOTE_MAX_LENGTH).toBe(1000);
    expect(screen.getByText("0/1000 characters")).toBeDefined();
    expect(field.getAttribute("aria-describedby")).toBe("credit-note-count");

    await user.type(field, "Hi");
    expect(screen.getByText("2/1000 characters")).toBeDefined();
  });

  it("sends the trimmed note as the fourth argument on Save, alongside name, email and honeypot", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    await user.type(screen.getByPlaceholderText("Your name"), "Ada");
    await user.type(noteField(), "  Broader term fits better.\nSee FOLIO.  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmitCredit).toHaveBeenCalledTimes(1);
    expect(onSubmitCredit).toHaveBeenCalledWith("Ada", null, "", "Broader term fits better.\nSee FOLIO.");
  });

  it("still sends the note when credit is skipped", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    await user.type(noteField(), "Typo in label");
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(onSubmitCredit).toHaveBeenCalledWith(null, null, "", "Typo in label");
  });

  it("omits an empty or whitespace-only note entirely (three-argument call)", async () => {
    const user = userEvent.setup();
    render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    await user.type(noteField(), "    ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmitCredit).toHaveBeenCalledTimes(1);
    expect(onSubmitCredit.mock.calls[0]).toEqual([null, null, ""]);
    expect(onSubmitCredit.mock.calls[0]).toHaveLength(3);
  });

  it("keeps forwarding the honeypot verbatim when a note is present", () => {
    render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    fireEvent.change(document.querySelector('input[name="website"]')!, { target: { value: "http://spam.example" } });
    fireEvent.change(noteField(), { target: { value: "note" } });
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onSubmitCredit).toHaveBeenCalledWith(null, null, "http://spam.example", "note");
  });

  it("clears the note every time the modal re-opens", () => {
    const { rerender } = render(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);
    fireEvent.change(noteField(), { target: { value: "stale note" } });
    expect(noteField().value).toBe("stale note");

    rerender(<CreditModal open={false} onSubmitCredit={onSubmitCredit} />);
    rerender(<CreditModal open={true} onSubmitCredit={onSubmitCredit} />);

    expect(noteField().value).toBe("");
  });
});

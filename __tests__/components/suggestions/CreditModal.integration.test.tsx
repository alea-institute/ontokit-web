import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreditModal } from "@/components/suggestions/CreditModal";
import { useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";

type Credit = [string | null, string | null, string];

function Gate({ submissions }: { submissions: Credit[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Submit proposal</button>
    <CreditModal open={open} onSubmitCredit={(...credit) => {
      submissions.push(credit);
      setOpen(false);
    }} />
  </>;
}

beforeEach(() => {
  useAnonymousCreditStore.getState().clearCredit();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  useAnonymousCreditStore.getState().clearCredit();
  localStorage.clear();
});

describe("credit dialog, persisted attribution, and dismissal", () => {
  it("restores saved attribution through storage rehydration for a new proposal", async () => {
    const user = userEvent.setup();
    const submissions: Credit[] = [];
    const view = render(<Gate submissions={submissions} />);
    await user.click(screen.getByRole("button", { name: "Submit proposal" }));
    await user.type(screen.getByPlaceholderText("Your name"), "  Ada  ");
    await user.type(screen.getByPlaceholderText("your@email.com"), "ada@example.org");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submissions).toEqual([["Ada", "ada@example.org", ""]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    const persisted = localStorage.getItem("ontokit-anonymous-credit")!;
    expect(JSON.parse(persisted).state).toEqual({ name: "Ada", email: "ada@example.org" });
    view.unmount();
    useAnonymousCreditStore.getState().clearCredit();
    localStorage.setItem("ontokit-anonymous-credit", persisted);
    await act(async () => { await useAnonymousCreditStore.persist.rehydrate(); });
    render(<Gate submissions={submissions} />);
    await user.click(screen.getByRole("button", { name: "Submit proposal" }));
    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Ada");
    expect((screen.getByPlaceholderText("your@email.com") as HTMLInputElement).value).toBe("ada@example.org");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submissions).toEqual([["Ada", "ada@example.org", ""], ["Ada", "ada@example.org", ""]]);
  });

  it.each(["Escape", "Close"])("%s submits once, preserves the honeypot signal, and discards unsaved drafts", async (dismiss) => {
    useAnonymousCreditStore.getState().setCredit("Remembered", "saved@example.org");
    const persisted = localStorage.getItem("ontokit-anonymous-credit");
    const user = userEvent.setup();
    const submissions: Credit[] = [];
    render(<Gate submissions={submissions} />);
    await user.click(screen.getByRole("button", { name: "Submit proposal" }));
    await user.clear(screen.getByPlaceholderText("Your name"));
    await user.type(screen.getByPlaceholderText("Your name"), "Unsaved");
    fireEvent.change(document.querySelector('input[name="website"]')!, { target: { value: "  bot.example  " } });
    if (dismiss === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(submissions).toEqual([[null, null, "  bot.example  "]]);
    expect(localStorage.getItem("ontokit-anonymous-credit")).toBe(persisted);
    await user.click(screen.getByRole("button", { name: "Submit proposal" }));
    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Remembered");
    expect(document.querySelector<HTMLInputElement>('input[name="website"]')!.value).toBe("");
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(submissions).toEqual([[null, null, "  bot.example  "], [null, null, ""]]);
  });
});

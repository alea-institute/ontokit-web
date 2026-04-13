import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// cmdk uses ResizeObserver and scrollIntoView which jsdom doesn't provide
const _origResizeObserver = global.ResizeObserver;
const _origScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  global.ResizeObserver = _origResizeObserver;
  Element.prototype.scrollIntoView = _origScrollIntoView;
  vi.restoreAllMocks();
});

// langToFlag needs the utils module
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    langToFlag: (lang: string) => (lang === "en" ? "\u{1F1FA}\u{1F1F8}" : lang === "fr" ? "\u{1F1EB}\u{1F1F7}" : null),
  };
});

import { LanguagePicker } from "@/components/editor/LanguagePicker";

describe("LanguagePicker", () => {
  it("renders a trigger button with the current language code", () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain("en");
  });

  it("shows aria-expanded=false when closed", () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("opens the dropdown and sets aria-expanded=true on click", async () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });
    // Should render the search input
    expect(screen.getByPlaceholderText("Search languages...")).toBeDefined();
  });

  it("shows 'Frequently used' and 'All languages' groups when open", async () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Language tag"));
    await waitFor(() => {
      expect(screen.getByText("Frequently used")).toBeDefined();
      expect(screen.getByText("All languages")).toBeDefined();
    });
  });

  it("calls onChange and closes when a language is selected", async () => {
    const onChange = vi.fn();
    render(<LanguagePicker value="en" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Language tag"));

    await waitFor(() => {
      expect(screen.getByText("French")).toBeDefined();
    });

    // Click the French option
    const frenchItem = screen.getByText("French").closest("[cmdk-item]");
    if (frenchItem) {
      fireEvent.click(frenchItem);
    }

    expect(onChange).toHaveBeenCalledWith("fr");
    // Verify the menu closed
    const btn = screen.getByLabelText("Language tag");
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("does not open when disabled", () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} disabled />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    expect(screen.queryByPlaceholderText("Search languages...")).toBeNull();
  });

  it("closes on Escape key", async () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("closes on outside click", async () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <LanguagePicker value="en" onChange={vi.fn()} />
      </div>
    );
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });

    fireEvent.mouseDown(screen.getByTestId("outside"));
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("displays flag emoji for known language codes", () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    expect(btn.textContent).toContain("\u{1F1FA}\u{1F1F8}");
  });

  it("shows 'lang' placeholder when value is empty", () => {
    render(<LanguagePicker value="" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    expect(btn.textContent).toContain("lang");
  });

  it("sets aria-controls to the list id when open", async () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });
    const controlsId = btn.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    // Verify a listbox element with the matching id exists
    const list = screen.getByRole("listbox");
    expect(list.getAttribute("id")).toBe(controlsId);
  });

  it("restores focus to trigger button after selecting a language", async () => {
    const onChange = vi.fn();
    render(<LanguagePicker value="en" onChange={onChange} />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("French")).toBeDefined();
    });

    const frenchItem = screen.getByText("French").closest("[cmdk-item]");
    if (frenchItem) fireEvent.click(frenchItem);

    // Wait for requestAnimationFrame focus restore
    await waitFor(() => {
      expect(document.activeElement).toBe(btn);
    });
  });

  it("restores focus to trigger button after Escape", async () => {
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    const btn = screen.getByLabelText("Language tag");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(document.activeElement).toBe(btn);
    });
  });

  it("shows 'Use custom code' option when search doesn't match a known language", async () => {
    const user = userEvent.setup();
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Language tag"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search languages...")).toBeDefined();
    });

    const input = screen.getByPlaceholderText("Search languages...");
    await user.type(input, "grc");

    await waitFor(() => {
      expect(screen.getByText(/Use custom code/)).toBeDefined();
      expect(screen.getByText(/grc/)).toBeDefined();
    });
  });

  it("calls onChange with custom code when 'Use custom code' is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguagePicker value="en" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Language tag"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search languages...")).toBeDefined();
    });

    const input = screen.getByPlaceholderText("Search languages...");
    await user.type(input, "cu");

    await waitFor(() => {
      expect(screen.getByText(/Use custom code/)).toBeDefined();
    });

    const customItem = screen.getByText(/Use custom code/).closest("[cmdk-item]");
    if (customItem) fireEvent.click(customItem);

    expect(onChange).toHaveBeenCalledWith("cu");
  });

  it("does not show custom code option when search matches a known language", async () => {
    const user = userEvent.setup();
    render(<LanguagePicker value="en" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Language tag"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search languages...")).toBeDefined();
    });

    const input = screen.getByPlaceholderText("Search languages...");
    await user.type(input, "fr");

    await waitFor(() => {
      expect(screen.getByText("French")).toBeDefined();
    });

    expect(screen.queryByText(/Use custom code/)).toBeNull();
  });
});

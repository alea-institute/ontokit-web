import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// cmdk uses ResizeObserver and scrollIntoView which jsdom doesn't provide
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

// langToFlag needs the utils module
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    langToFlag: (lang: string) => (lang === "en" ? "🇺🇸" : lang === "fr" ? "🇫🇷" : null),
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
    expect(btn.textContent).toContain("🇺🇸");
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
      const controlsId = btn.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId!)).toBeDefined();
    });
  });
});

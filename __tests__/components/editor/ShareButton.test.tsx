import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock dependencies
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: vi.fn(() => ({ success: mockSuccess, error: mockError })),
}));

import { ShareButton } from "@/components/editor/ShareButton";

describe("ShareButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });
    mockSuccess.mockClear();
    mockError.mockClear();
  });

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  // ── Simple button (no selectedIri) ──────────────────────────────
  describe("simple button (no class selected)", () => {
    it("renders a Share button", () => {
      render(<ShareButton projectId="proj-1" />);
      expect(screen.getByLabelText("Copy project link")).toBeDefined();
    });

    it("renders the text 'Share'", () => {
      render(<ShareButton projectId="proj-1" />);
      expect(screen.getByText("Share")).toBeDefined();
    });

    it("copies the project URL on click", async () => {
      render(<ShareButton projectId="proj-1" />);
      await act(async () => {
        screen.getByLabelText("Copy project link").click();
      });
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("/projects/proj-1")
      );
      expect(mockSuccess).toHaveBeenCalledWith("Copied project link");
    });

    it("shows error toast when clipboard fails", async () => {
      writeTextMock.mockRejectedValueOnce(new Error("fail"));
      render(<ShareButton projectId="proj-1" />);
      await act(async () => {
        screen.getByLabelText("Copy project link").click();
      });
      expect(mockError).toHaveBeenCalledWith("Failed to copy link");
    });
  });

  // ── Split button (with selectedIri) ─────────────────────────────
  describe("split button (class selected)", () => {
    const iri = "http://example.org/ontology#Person";
    const label = "Person";

    it("renders the label in the primary button", () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      expect(screen.getByLabelText(`Copy link to ${label}`)).toBeDefined();
    });

    it("copies the class URL on primary button click", async () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      await act(async () => {
        screen.getByLabelText(`Copy link to ${label}`).click();
      });
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining(`classIri=${encodeURIComponent(iri)}`)
      );
      expect(mockSuccess).toHaveBeenCalledWith(`Copied link to "${label}"`);
    });

    it("opens dropdown on chevron click", () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      const chevron = screen.getByLabelText("More share options");
      fireEvent.click(chevron);
      expect(screen.getByRole("menu")).toBeDefined();
    });

    it("dropdown has both copy options", () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      fireEvent.click(screen.getByLabelText("More share options"));
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(2);
    });

    it("dropdown 'Copy project link' copies project URL", async () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      fireEvent.click(screen.getByLabelText("More share options"));
      await act(async () => {
        screen.getByText("Copy project link").click();
      });
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedUrl = writeTextMock.mock.calls[0][0] as string;
      expect(copiedUrl).toContain("/projects/proj-1");
      expect(copiedUrl).not.toContain("classIri");
      expect(mockSuccess).toHaveBeenCalledWith("Copied project link");
    });

    it("closes dropdown on Escape", () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      fireEvent.click(screen.getByLabelText("More share options"));
      expect(screen.getByRole("menu")).toBeDefined();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("closes dropdown on outside click", () => {
      render(
        <div>
          <button data-testid="outside">Outside</button>
          <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
        </div>
      );
      fireEvent.click(screen.getByLabelText("More share options"));
      expect(screen.getByRole("menu")).toBeDefined();
      fireEvent.mouseDown(screen.getByTestId("outside"));
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("closes dropdown after copying from primary button", async () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      fireEvent.click(screen.getByLabelText("More share options"));
      expect(screen.getByRole("menu")).toBeDefined();
      await act(async () => {
        screen.getByLabelText(`Copy link to ${label}`).click();
      });
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("sets aria-expanded on chevron button", () => {
      render(
        <ShareButton projectId="proj-1" selectedIri={iri} selectedLabel={label} />
      );
      const chevron = screen.getByLabelText("More share options");
      expect(chevron.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(chevron);
      expect(chevron.getAttribute("aria-expanded")).toBe("true");
    });
  });

  // ── Truncation ──────────────────────────────────────────────────
  describe("label truncation", () => {
    it("does not truncate labels <= 24 chars", () => {
      const shortLabel = "ShortLabel"; // 10 chars
      render(
        <ShareButton
          projectId="proj-1"
          selectedIri="http://example.org#X"
          selectedLabel={shortLabel}
        />
      );
      // The label should appear without ellipsis
      const primaryBtn = screen.getByLabelText(`Copy link to ${shortLabel}`);
      expect(primaryBtn.textContent).toContain(shortLabel);
      expect(primaryBtn.textContent).not.toContain("\u2026");
    });

    it("truncates labels > 24 chars to 23 + ellipsis", () => {
      // 26 chars — slice(0, 23) = "ThisIsAVeryLongClassNam" + ellipsis
      const longLabel = "ThisIsAVeryLongClassName25";
      const expectedTruncated = "ThisIsAVeryLongClassNam\u2026";
      render(
        <ShareButton
          projectId="proj-1"
          selectedIri="http://example.org#X"
          selectedLabel={longLabel}
        />
      );
      const primaryBtn = screen.getByLabelText(`Copy link to ${longLabel}`);
      expect(primaryBtn.textContent).toContain(expectedTruncated);
    });

    it("uses getLocalName when no selectedLabel is provided", () => {
      render(
        <ShareButton
          projectId="proj-1"
          selectedIri="http://example.org/ontology#MyClass"
        />
      );
      // getLocalName extracts "MyClass"
      expect(screen.getByLabelText("Copy link to MyClass")).toBeDefined();
    });
  });
});

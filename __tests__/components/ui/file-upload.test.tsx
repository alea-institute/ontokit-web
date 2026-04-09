import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUpload } from "@/components/ui/file-upload";

describe("FileUpload", () => {
  const defaultProps = {
    onFileSelect: vi.fn(),
    selectedFile: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Drop zone rendering ─────────────────────────────────────────
  it("renders the upload drop zone when no file is selected", () => {
    render(<FileUpload {...defaultProps} />);
    expect(screen.getByText("Click to upload or drag and drop")).toBeDefined();
  });

  it("shows supported formats info", () => {
    render(<FileUpload {...defaultProps} />);
    expect(screen.getByText("OWL, RDF, Turtle, N3, or JSON-LD (max 50 MB)")).toBeDefined();
  });

  it("renders a hidden file input with correct accept attribute", () => {
    const { container } = render(<FileUpload {...defaultProps} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe(".owl,.rdf,.ttl,.n3,.jsonld");
    expect(input.className).toContain("hidden");
  });

  // ── File selection ──────────────────────────────────────────────
  it("calls onFileSelect when a valid file is selected via input", async () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <FileUpload {...defaultProps} onFileSelect={onFileSelect} />
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["content"], "test.ttl", { type: "text/turtle" });
    await userEvent.upload(input, file);
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("rejects unsupported file formats", () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <FileUpload {...defaultProps} onFileSelect={onFileSelect} />
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    // Use fireEvent.change since userEvent.upload respects the accept attribute
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelect).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Unsupported file format/)).toBeDefined();
  });

  it("rejects files larger than 50MB", () => {
    const onFileSelect = vi.fn();
    const { container } = render(
      <FileUpload {...defaultProps} onFileSelect={onFileSelect} />
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    // Create a file object that reports as > 50MB
    const largeFile = new File(["x"], "big.owl", { type: "application/rdf+xml" });
    Object.defineProperty(largeFile, "size", { value: 51 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [largeFile] } });
    expect(onFileSelect).toHaveBeenCalledWith(null);
    expect(screen.getByText(/File too large/)).toBeDefined();
  });

  // ── Selected file display ───────────────────────────────────────
  it("shows file name when a file is selected", () => {
    const file = new File(["content"], "ontology.ttl", { type: "text/turtle" });
    render(<FileUpload {...defaultProps} selectedFile={file} />);
    expect(screen.getByText("ontology.ttl")).toBeDefined();
  });

  it("shows file size when a file is selected", () => {
    const file = new File(["x".repeat(2048)], "ontology.owl");
    render(<FileUpload {...defaultProps} selectedFile={file} />);
    expect(screen.getByText("2.0 KB")).toBeDefined();
  });

  it("calls onFileSelect(null) when remove button is clicked", async () => {
    const onFileSelect = vi.fn();
    const file = new File(["content"], "ontology.ttl");
    render(
      <FileUpload {...defaultProps} onFileSelect={onFileSelect} selectedFile={file} />
    );
    const removeBtn = screen.getByRole("button");
    await userEvent.click(removeBtn);
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  // ── Drag and drop ──────────────────────────────────────────────
  it("shows drag text on dragover", () => {
    render(<FileUpload {...defaultProps} />);
    const label = screen.getByText("Click to upload or drag and drop").closest("label")!;
    fireEvent.dragOver(label);
    expect(screen.getByText("Drop your file here")).toBeDefined();
  });

  it("reverts text on dragleave", () => {
    render(<FileUpload {...defaultProps} />);
    const label = screen.getByText("Click to upload or drag and drop").closest("label")!;
    fireEvent.dragOver(label);
    expect(screen.getByText("Drop your file here")).toBeDefined();
    fireEvent.dragLeave(label);
    expect(screen.getByText("Click to upload or drag and drop")).toBeDefined();
  });

  // ── Disabled state ─────────────────────────────────────────────
  it("applies disabled styling when disabled", () => {
    const { container } = render(<FileUpload {...defaultProps} disabled />);
    const label = container.querySelector("label");
    expect(label?.className).toContain("cursor-not-allowed");
    expect(label?.className).toContain("opacity-50");
  });

  // ── Error prop ─────────────────────────────────────────────────
  it("displays external error prop", () => {
    const file = new File(["content"], "test.owl");
    render(
      <FileUpload
        {...defaultProps}
        selectedFile={file}
        error="Upload failed"
      />
    );
    expect(screen.getByText("Upload failed")).toBeDefined();
  });
});

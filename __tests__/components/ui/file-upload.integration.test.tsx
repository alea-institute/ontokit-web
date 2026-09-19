import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileUpload } from "@/components/ui/file-upload";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";

function UploadPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  function select(next: File | null) {
    setFile(next);
    setLabel("");
    if (!next) return;
    const reader = new FileReader();
    reader.onload = () => {
      const triples = parseBlockTriples(String(reader.result), "https://example.org/Cat");
      const value = triples?.find((triple) => triple.predicate.endsWith("#label"))?.object;
      setLabel(value?.type === "literal" ? value.value : "No label");
    };
    reader.readAsText(next);
  }
  return <><FileUpload selectedFile={file} onFileSelect={select} /><output>{label}</output></>;
}

function dropZone() {
  return screen.getByText("Click to upload or drag and drop").closest("label")!;
}

describe("FileUpload selection integration", () => {
  it("reads dropped Turtle through FileReader and the real parser, then removes the preview", async () => {
    render(<UploadPreview />);
    const source = '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n<https://example.org/Cat> rdfs:label "Cat 🐈"@en .';
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([source], "cats.TTL")] } });
    expect(await screen.findByText("Cat 🐈")).toBeDefined();
    expect(screen.getByText("cats.TTL")).toBeDefined();
    await userEvent.click(screen.getByRole("button"));
    expect(dropZone()).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("accepts only the first file in a multi-file drop", () => {
    const select = vi.fn();
    render(<FileUpload selectedFile={null} onFileSelect={select} />);
    const first = new File([""], "first.n3");
    fireEvent.drop(dropZone(), { dataTransfer: { files: [first, new File([""], "second.txt")] } });
    expect(select).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("clears the drag state on an empty drop without changing selection", () => {
    const select = vi.fn();
    render(<FileUpload selectedFile={null} onFileSelect={select} />);
    const zone = dropZone();
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(dropZone()).toBeDefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("ignores dropped files when disabled and disables the native picker", () => {
    const select = vi.fn();
    const { container } = render(<FileUpload selectedFile={null} onFileSelect={select} disabled />);
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([""], "a.owl")] } });
    expect(select).not.toHaveBeenCalled();
    expect(container.querySelector("input")?.disabled).toBe(true);
  });

  it.each([[], null])("ignores an empty or cancelled native picker (%j)", (files) => {
    const select = vi.fn();
    const { container } = render(<FileUpload selectedFile={null} onFileSelect={select} />);
    fireEvent.change(container.querySelector("input")!, { target: { files } });
    expect(select).not.toHaveBeenCalled();
  });

  it("accepts exactly 50 MB and rejects the next byte", () => {
    const select = vi.fn();
    render(<FileUpload selectedFile={null} onFileSelect={select} />);
    const file = new File(["x"], "limit.jsonld");
    Object.defineProperty(file, "size", { configurable: true, value: 50 * 1024 * 1024 });
    fireEvent.drop(dropZone(), { dataTransfer: { files: [file] } });
    expect(select).toHaveBeenLastCalledWith(file);
    Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
    fireEvent.drop(dropZone(), { dataTransfer: { files: [file] } });
    expect(select).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("File too large. Maximum size is 50 MB")).toBeDefined();
  });

  it("recovers from an invalid drop using a valid empty ontology", async () => {
    render(<UploadPreview />);
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([""], "no-extension")] } });
    expect(screen.getByText(/Unsupported file format/)).toBeDefined();
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([""], "empty.rdf")] } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("No label"));
    expect(screen.queryByText(/Unsupported file format/)).toBeNull();
  });

  it("gives an external error priority and reveals validation after it clears", () => {
    const select = vi.fn();
    const { rerender } = render(<FileUpload selectedFile={null} onFileSelect={select} error="Server unavailable" />);
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([""], "bad.txt")] } });
    expect(screen.getByText("Server unavailable")).toBeDefined();
    expect(screen.queryByText(/Unsupported file format/)).toBeNull();
    rerender(<FileUpload selectedFile={null} onFileSelect={select} error={null} />);
    expect(screen.getByText(/Unsupported file format/)).toBeDefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OntologyFilePicker } from "@/components/projects/ontology-file-picker";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Check: (props: Record<string, unknown>) => <span data-testid="check" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="file-text" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="alert-circle" {...props} />
  ),
}));

// Mock projectApi
const mockScanGitHubRepoFiles = vi.fn();
vi.mock("@/lib/api/projects", () => ({
  projectApi: {
    scanGitHubRepoFiles: (...args: unknown[]) => mockScanGitHubRepoFiles(...args),
  },
}));

beforeEach(() => {
  mockScanGitHubRepoFiles.mockReset();
});

const ttlFile = { path: "ontology.ttl", size: 1024 };
const owlFile = { path: "ontology.owl", size: 2048 };
const bigFile = { path: "large.rdf", size: 1048576 };

describe("OntologyFilePicker", () => {
  it("shows loading state while scanning", () => {
    mockScanGitHubRepoFiles.mockReturnValue(new Promise(() => {}));
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByText("Scanning repository for ontology files..."),
    ).toBeDefined();
  });

  it("shows error on scan failure", async () => {
    mockScanGitHubRepoFiles.mockRejectedValue(new Error("Scan failed"));
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Scan failed")).toBeDefined();
    });
  });

  it("shows empty state when no files found", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({ items: [] });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("No ontology files found")).toBeDefined();
    });
  });

  it("auto-selects and calls onSelect for a single .ttl file", async () => {
    const onSelect = vi.fn();
    mockScanGitHubRepoFiles.mockResolvedValue({ items: [ttlFile] });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={onSelect} />,
    );
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(ttlFile, "ontology.ttl");
    });
  });

  it("renders file list with sizes", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile, owlFile, bigFile],
    });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });
    expect(screen.getByText("ontology.owl")).toBeDefined();
    expect(screen.getByText("large.rdf")).toBeDefined();
    expect(screen.getByText("1.0 KB")).toBeDefined();
    expect(screen.getByText("1.0 MB")).toBeDefined();
  });

  it("selects a ttl file and calls onSelect immediately", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile, owlFile],
    });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={onSelect} />,
    );
    await waitFor(() => {
      expect(screen.getByText("ontology.ttl")).toBeDefined();
    });
    await user.click(screen.getByText("ontology.ttl"));
    expect(onSelect).toHaveBeenCalledWith(ttlFile, "ontology.ttl");
  });

  it("shows turtle path substep for non-ttl files", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({ items: [owlFile] });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("ontology.owl")).toBeDefined();
    });
    // Single non-.ttl file auto-selects visually, showing turtle path section
    expect(screen.getByText(/not Turtle/)).toBeDefined();
  });

  it("displays file count header correctly for multiple files", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile, owlFile],
    });
    render(
      <OntologyFilePicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Found 2 ontology files/)).toBeDefined();
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TurtleOutputPicker } from "@/components/projects/turtle-output-picker";

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Check: (props: Record<string, unknown>) => <span data-testid="check" {...props} />,
  FileText: (props: Record<string, unknown>) => <span data-testid="file-text" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => (
    <span data-testid="alert-circle" {...props} />
  ),
  PenLine: (props: Record<string, unknown>) => <span data-testid="pen-line" {...props} />,
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

const ttlFile1 = { path: "main.ttl", size: 512 };
const ttlFile2 = { path: "secondary.ttl", size: 256 };
const owlFile = { path: "ontology.owl", size: 1024 };

describe("TurtleOutputPicker", () => {
  it("shows loading spinner while scanning", () => {
    mockScanGitHubRepoFiles.mockReturnValue(new Promise(() => {}));
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByText("Scanning repository for .ttl files..."),
    ).toBeDefined();
  });

  it("shows error state on failure", async () => {
    mockScanGitHubRepoFiles.mockRejectedValue(new Error("Scan error"));
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Scan error")).toBeDefined();
    });
  });

  it("auto-selects single .ttl file and calls onSelect", async () => {
    const onSelect = vi.fn();
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile1, owlFile],
    });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={onSelect} />,
    );
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith("main.ttl");
    });
    // Shows confirmation badge
    expect(screen.getByText("main.ttl")).toBeDefined();
  });

  it("shows new path mode when no ttl files exist", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [owlFile],
    });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Define new file path")).toBeDefined();
    });
    // Default custom path is "ontology.ttl"
    expect(screen.getByDisplayValue("ontology.ttl")).toBeDefined();
  });

  it("confirms custom path on button click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockScanGitHubRepoFiles.mockResolvedValue({ items: [owlFile] });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={onSelect} />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("ontology.ttl")).toBeDefined();
    });

    await user.click(screen.getByText("Confirm"));
    expect(onSelect).toHaveBeenCalledWith("ontology.ttl");
  });

  it("disables Confirm button for non-.ttl path", async () => {
    const user = userEvent.setup();
    mockScanGitHubRepoFiles.mockResolvedValue({ items: [owlFile] });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("ontology.ttl")).toBeDefined();
    });

    const input = screen.getByDisplayValue("ontology.ttl");
    await user.clear(input);
    await user.type(input, "file.owl");

    expect(screen.getByText("Path must end with .ttl")).toBeDefined();
    expect(screen.getByText("Confirm").closest("button")?.hasAttribute("disabled")).toBe(true);
  });

  it("lists multiple .ttl files in existing mode", async () => {
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile1, ttlFile2, owlFile],
    });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Use existing .ttl file")).toBeDefined();
    });
    expect(screen.getByText("main.ttl")).toBeDefined();
    expect(screen.getByText("secondary.ttl")).toBeDefined();
  });

  it("selects an existing .ttl file from list", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockScanGitHubRepoFiles.mockResolvedValue({
      items: [ttlFile1, ttlFile2, owlFile],
    });
    render(
      <TurtleOutputPicker owner="o" repo="r" token="t" onSelect={onSelect} />,
    );
    await waitFor(() => {
      expect(screen.getByText("main.ttl")).toBeDefined();
    });

    await user.click(screen.getByText("secondary.ttl"));
    expect(onSelect).toHaveBeenCalledWith("secondary.ttl");
  });
});

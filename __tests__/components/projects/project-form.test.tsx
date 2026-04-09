import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectForm } from "@/components/projects/project-form";

describe("ProjectForm", () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default props", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/Project Name/)).toBeDefined();
    expect(screen.getByLabelText("Description")).toBeDefined();
    expect(screen.getByText("Visibility")).toBeDefined();
    expect(screen.getByText("Private")).toBeDefined();
    expect(screen.getByText("Public")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeDefined();
  });

  it("uses custom submitLabel", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} submitLabel="Save Changes" />);

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDefined();
  });

  it("renders cancel button when onCancel is provided", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("does not render cancel button when onCancel is not provided", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it("populates fields from initialData", () => {
    render(
      <ProjectForm
        onSubmit={mockOnSubmit}
        initialData={{ name: "My Project", description: "A description", is_public: true }}
      />
    );

    expect((screen.getByLabelText(/Project Name/) as HTMLInputElement).value).toBe("My Project");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("A description");
  });

  it("submit button is disabled when name is required but empty", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    const submitBtn = screen.getByRole("button", { name: "Create Project" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables submit when name is entered", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Test Project");

    const submitBtn = screen.getByRole("button", { name: "Create Project" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits form data correctly with private visibility", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Test Project");
    await user.type(screen.getByLabelText("Description"), "A test description");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Test Project",
      description: "A test description",
      is_public: false,
    });
  });

  it("submits form data with public visibility", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Public Project");
    await user.click(screen.getByText("Public"));
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Public Project",
      description: undefined,
      is_public: true,
    });
  });

  it("toggles visibility between private and public", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Test");

    // Start private, switch to public, back to private
    await user.click(screen.getByText("Public"));
    await user.click(screen.getByText("Private"));
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: false })
    );
  });

  it("displays error when onSubmit throws", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValueOnce(new Error("Server error"));
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Test");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByText("Server error")).toBeDefined();
  });

  it("displays generic error for non-Error throws", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValueOnce("something went wrong");
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "Test");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(await screen.findByText("An error occurred")).toBeDefined();
  });

  it("shows 'Saving...' when isLoading is true", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={true} />);

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDefined();
  });

  it("disables inputs when isLoading is true", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={true} />);

    expect((screen.getByLabelText(/Project Name/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("allows empty name when nameRequired is false", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} nameRequired={false} />);

    // Submit button should be enabled even with empty name
    const submitBtn = screen.getByRole("button", { name: "Create Project" });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "" })
    );
  });

  it("uses custom placeholder text", () => {
    render(
      <ProjectForm
        onSubmit={mockOnSubmit}
        namePlaceholder="Enter name here"
        descriptionPlaceholder="Enter description here"
      />
    );

    expect(screen.getByPlaceholderText("Enter name here")).toBeDefined();
    expect(screen.getByPlaceholderText("Enter description here")).toBeDefined();
  });

  it("trims whitespace from name and description before submitting", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/Project Name/), "  Trimmed  ");
    await user.type(screen.getByLabelText("Description"), "  Some desc  ");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Trimmed",
      description: "Some desc",
      is_public: false,
    });
  });
});

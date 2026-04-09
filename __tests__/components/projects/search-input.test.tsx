import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserSearchInput } from "@/components/projects/user-search-input";
import { userSettingsApi } from "@/lib/api/userSettings";

vi.mock("@/lib/api/userSettings", () => ({
  userSettingsApi: {
    searchUsers: vi.fn(),
  },
}));

const mockSearchUsers = vi.mocked(userSettingsApi.searchUsers);

const mockUsers = [
  { id: "u-1", username: "alice", display_name: "Alice Smith", email: "alice@test.com" },
  { id: "u-2", username: "bob", display_name: "Bob Jones", email: "bob@test.com" },
];

describe("UserSearchInput", () => {
  const defaultProps = {
    value: "",
    onSelect: vi.fn(),
    onClear: vi.fn(),
    token: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders search input with placeholder", () => {
    render(<UserSearchInput {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search by name, username, or email...")
    ).toBeDefined();
  });

  it("does not search when query is less than 2 characters", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "a"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it("searches after debounce when query is 2+ characters", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "ali"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockSearchUsers).toHaveBeenCalledWith("test-token", "ali", 10);
  });

  it("shows dropdown results after search", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "ali"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeDefined();
      expect(screen.getByText("Bob Jones")).toBeDefined();
    });
  });

  it("calls onSelect when a result is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "ali"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeDefined();
    });

    // Use mouseDown on the list item (component uses onMouseDown)
    const item = screen.getByText("Alice Smith").closest("li")!;
    await act(async () => {
      item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(defaultProps.onSelect).toHaveBeenCalledWith("u-1");
  });

  it("shows selected user name in input after selection", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name, username, or email...") as HTMLInputElement;
    expect(input.value).toBe("");

    await user.type(input, "ali");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeDefined();
    });

    const item = screen.getByText("Alice Smith").closest("li")!;
    await act(async () => {
      item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    // After selection, the input should show the name
    expect(input.value).toBe("Alice Smith");
  });

  it("disables input when disabled prop is true", () => {
    render(<UserSearchInput {...defaultProps} disabled={true} />);

    const input = screen.getByPlaceholderText("Search by name, username, or email...") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("handles keyboard navigation - Escape closes dropdown", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name, username, or email...");
    await user.type(input, "ali");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeDefined();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Alice Smith")).toBeNull();
    });
  });

  it("handles search API errors gracefully", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockRejectedValue(new Error("Network error"));
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "ali"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Should not crash - dropdown should not be shown
    await waitFor(() => {
      expect(screen.queryByText("Alice Smith")).toBeNull();
    });
  });

  it("displays usernames with @ prefix in results", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSearchUsers.mockResolvedValue({ items: mockUsers, total: 2 });
    render(<UserSearchInput {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Search by name, username, or email..."),
      "ali"
    );
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(screen.getByText("@alice")).toBeDefined();
      expect(screen.getByText("@bob")).toBeDefined();
    });
  });
});

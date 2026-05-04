import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Provide localStorage before component imports (jsdom may not have it ready)
vi.hoisted(() => {
  if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

import { EntityTreeToolbar } from "@/components/editor/shared/EntityTreeToolbar";

describe("EntityTreeToolbar", () => {
  const baseProps = {
    showSearch: false,
    searchQuery: "",
    onToggleSearch: vi.fn(),
    onSearchChange: vi.fn(),
    onCloseSearch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders search toggle button", () => {
    render(<EntityTreeToolbar {...baseProps} />);
    expect(screen.getByLabelText("Search entities")).toBeDefined();
  });

  it("renders add button when canAdd is true", () => {
    render(<EntityTreeToolbar {...baseProps} canAdd onAdd={vi.fn()} />);
    expect(screen.getByLabelText("Add entity")).toBeDefined();
  });

  it("does not render add button when canAdd is false", () => {
    render(<EntityTreeToolbar {...baseProps} canAdd={false} />);
    expect(screen.queryByLabelText("Add entity")).toBeNull();
  });

  it("calls onAdd when add button is clicked", async () => {
    const onAdd = vi.fn();
    render(<EntityTreeToolbar {...baseProps} canAdd onAdd={onAdd} />);
    await userEvent.click(screen.getByLabelText("Add entity"));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onToggleSearch when search button is clicked", async () => {
    const onToggleSearch = vi.fn();
    render(<EntityTreeToolbar {...baseProps} onToggleSearch={onToggleSearch} />);
    await userEvent.click(screen.getByLabelText("Search entities"));
    expect(onToggleSearch).toHaveBeenCalledOnce();
  });

  it("shows search input when showSearch is true", () => {
    render(<EntityTreeToolbar {...baseProps} showSearch />);
    expect(screen.getByPlaceholderText("Search classes, properties, individuals...")).toBeDefined();
  });

  it("does not show search input when showSearch is false", () => {
    render(<EntityTreeToolbar {...baseProps} showSearch={false} />);
    expect(screen.queryByPlaceholderText("Search classes, properties, individuals...")).toBeNull();
  });

  it("calls onSearchChange when typing in search input", async () => {
    const onSearchChange = vi.fn();
    render(
      <EntityTreeToolbar
        {...baseProps}
        showSearch
        onSearchChange={onSearchChange}
      />,
    );
    const input = screen.getByPlaceholderText("Search classes, properties, individuals...");
    await userEvent.type(input, "foo");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("calls onCloseSearch on Escape in search input", () => {
    const onCloseSearch = vi.fn();
    render(
      <EntityTreeToolbar
        {...baseProps}
        showSearch
        onCloseSearch={onCloseSearch}
      />,
    );
    const input = screen.getByPlaceholderText("Search classes, properties, individuals...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCloseSearch).toHaveBeenCalledOnce();
  });

  it("renders expand/collapse buttons when callbacks provided", () => {
    render(
      <EntityTreeToolbar
        {...baseProps}
        onExpandOneLevel={vi.fn()}
        onExpandAllFully={vi.fn()}
        onCollapseAll={vi.fn()}
        onCollapseOneLevel={vi.fn()}
        hasExpandableNodes
        hasExpandedNodes
      />,
    );
    expect(screen.getByLabelText("Expand one level")).toBeDefined();
    expect(screen.getByLabelText("Expand all levels")).toBeDefined();
    expect(screen.getByLabelText("Collapse all")).toBeDefined();
    expect(screen.getByLabelText("Collapse one level")).toBeDefined();
  });

  it("disables expand buttons when no expandable nodes", () => {
    render(
      <EntityTreeToolbar
        {...baseProps}
        onExpandOneLevel={vi.fn()}
        onExpandAllFully={vi.fn()}
        hasExpandableNodes={false}
      />,
    );
    expect((screen.getByLabelText("Expand one level") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Expand all levels") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables collapse buttons when no expanded nodes", () => {
    render(
      <EntityTreeToolbar
        {...baseProps}
        onCollapseAll={vi.fn()}
        onCollapseOneLevel={vi.fn()}
        hasExpandedNodes={false}
      />,
    );
    expect((screen.getByLabelText("Collapse all") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Collapse one level") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows dismissible tip when localStorage not set", () => {
    render(
      <EntityTreeToolbar
        {...baseProps}
        onExpandOneLevel={vi.fn()}
        onExpandAllFully={vi.fn()}
      />,
    );
    expect(screen.getByText(/Tip: click Expand/)).toBeDefined();
  });

  it("dismisses tip when dismiss button clicked", async () => {
    render(
      <EntityTreeToolbar
        {...baseProps}
        onExpandOneLevel={vi.fn()}
        onExpandAllFully={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText("Dismiss tip"));
    expect(screen.queryByText(/Tip: click Expand/)).toBeNull();
  });
});

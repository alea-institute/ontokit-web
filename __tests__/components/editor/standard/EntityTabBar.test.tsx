import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { EntityTabBar } from "@/components/editor/standard/EntityTabBar";

describe("EntityTabBar", () => {
  const onTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three tabs", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    expect(screen.getByText("Classes")).toBeDefined();
    expect(screen.getByText("Properties")).toBeDefined();
    expect(screen.getByText("Individuals")).toBeDefined();
  });

  it("applies active styling to the classes tab when active", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    const classesBtn = screen.getByText("Classes");
    expect(classesBtn.className).toContain("border-primary-600");
  });

  it("applies inactive styling to non-active tabs", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    const propertiesBtn = screen.getByText("Properties");
    expect(propertiesBtn.className).toContain("text-slate-500");
    expect(propertiesBtn.className).not.toContain("border-primary-600");
  });

  it("applies active styling to properties tab when active", () => {
    render(<EntityTabBar activeTab="properties" onTabChange={onTabChange} />);
    const propertiesBtn = screen.getByText("Properties");
    expect(propertiesBtn.className).toContain("border-primary-600");
  });

  it("applies active styling to individuals tab when active", () => {
    render(<EntityTabBar activeTab="individuals" onTabChange={onTabChange} />);
    const individualsBtn = screen.getByText("Individuals");
    expect(individualsBtn.className).toContain("border-primary-600");
  });

  it("calls onTabChange with 'classes' when Classes is clicked", () => {
    render(<EntityTabBar activeTab="properties" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Classes"));
    expect(onTabChange).toHaveBeenCalledWith("classes");
  });

  it("calls onTabChange with 'properties' when Properties is clicked", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(onTabChange).toHaveBeenCalledWith("properties");
  });

  it("calls onTabChange with 'individuals' when Individuals is clicked", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Individuals"));
    expect(onTabChange).toHaveBeenCalledWith("individuals");
  });

  it("calls onTabChange even when clicking the already-active tab", () => {
    render(<EntityTabBar activeTab="classes" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Classes"));
    expect(onTabChange).toHaveBeenCalledWith("classes");
  });
});

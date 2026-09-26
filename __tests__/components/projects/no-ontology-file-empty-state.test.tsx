import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NoOntologyFileEmptyState } from "@/components/projects/NoOntologyFileEmptyState";

afterEach(cleanup);

const settingsCopy = "Import an ontology file from the project settings.";
const unavailableCopy =
  "Project settings are unavailable in this configuration, so an ontology file can't be added here. Import one as a new project instead.";

describe("NoOntologyFileEmptyState", () => {
  it("points a manager at project settings when settings are usable", () => {
    render(<NoOntologyFileEmptyState projectId="p-1" settingsAvailable canManage />);
    expect(screen.getByRole("heading", { name: "No Ontology File" })).toBeTruthy();
    expect(screen.getByText("This project doesn't have an ontology file yet.")).toBeTruthy();
    expect(screen.getByText(settingsCopy)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Settings" }).getAttribute("href")).toBe("/projects/p-1/settings");
    expect(screen.queryByRole("link", { name: "Import a new project" })).toBeNull();
  });

  it("points a manager at a new import when settings are unavailable", () => {
    render(<NoOntologyFileEmptyState projectId="p-1" settingsAvailable={false} canManage />);
    expect(screen.getByText(unavailableCopy)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Import a new project" }).getAttribute("href")).toBe("/projects/new");
    expect(screen.queryByRole("link", { name: "Go to Settings" })).toBeNull();
  });

  it.each([true, false])("offers a non-manager no action (settings available: %s)", (settingsAvailable) => {
    render(<NoOntologyFileEmptyState projectId="p-1" settingsAvailable={settingsAvailable} canManage={false} />);
    expect(screen.getByRole("heading", { name: "No Ontology File" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(settingsCopy)).toBeNull();
    expect(screen.queryByText(unavailableCopy)).toBeNull();
  });
});

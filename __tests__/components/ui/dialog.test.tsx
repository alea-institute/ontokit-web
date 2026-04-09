import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  it("renders trigger button", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Open")).toBeDefined();
  });

  it("does not show content when closed", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText("Title")).toBeNull();
  });

  it("shows content when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
          <DialogDescription>My description</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("My Title")).toBeDefined();
    expect(screen.getByText("My description")).toBeDefined();
  });

  it("opens dialog when trigger is clicked", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Content here</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText("Dialog Title")).toBeNull();
    await userEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Dialog Title")).toBeDefined();
  });

  it("renders close button with sr-only text", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Close")).toBeDefined();
  });

  it("renders DialogHeader with children", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header Title</DialogTitle>
          </DialogHeader>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Header Title")).toBeDefined();
  });

  it("renders DialogFooter with children", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Save")).toBeDefined();
  });

  it("renders DialogTitle with correct heading role", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Heading Test</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("heading", { name: "Heading Test" })).toBeDefined();
  });

  it("closes dialog when close button is clicked", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Closeable</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Closeable")).toBeDefined();
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await userEvent.click(closeBtn);
    // Wait for dialog content to be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText("Closeable")).toBeNull();
    });
  });

  it("renders dialog role on content", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Role Test</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

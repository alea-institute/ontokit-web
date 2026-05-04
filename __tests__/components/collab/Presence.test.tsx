import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Presence, UserAvatar, Cursors } from "@/components/collab/Presence";
import type { User } from "@/lib/collab/client";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: "u1",
    display_name: "Alice Smith",
    client_type: "web",
    client_version: "1.0",
    color: "#ff0000",
    ...overrides,
  };
}

describe("Presence", () => {
  it("renders nothing when only the current user is present", () => {
    const { container } = render(
      <Presence users={[makeUser({ user_id: "me" })]} currentUserId="me" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when users list is empty", () => {
    const { container } = render(
      <Presence users={[]} currentUserId="me" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders avatars for other users", () => {
    const users = [
      makeUser({ user_id: "me", display_name: "Me" }),
      makeUser({ user_id: "u2", display_name: "Bob Jones" }),
      makeUser({ user_id: "u3", display_name: "Carol" }),
    ];
    render(<Presence users={users} currentUserId="me" />);
    expect(screen.getByTitle("Bob Jones")).toBeDefined();
    expect(screen.getByTitle("Carol")).toBeDefined();
  });

  it("shows +N overflow when more than 3 other users", () => {
    const users = [
      makeUser({ user_id: "me" }),
      makeUser({ user_id: "u2", display_name: "B" }),
      makeUser({ user_id: "u3", display_name: "C" }),
      makeUser({ user_id: "u4", display_name: "D" }),
      makeUser({ user_id: "u5", display_name: "E" }),
    ];
    render(<Presence users={users} currentUserId="me" />);
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("shows +N for many overflow users", () => {
    const users = Array.from({ length: 7 }, (_, i) =>
      makeUser({ user_id: `u${i}`, display_name: `User ${i}` })
    );
    render(<Presence users={users} currentUserId="me" />);
    // 7 users, none is "me", so 7 others, 7-3 = 4 overflow
    expect(screen.getByText("+4")).toBeDefined();
  });
});

describe("UserAvatar", () => {
  it("renders initials from display name", () => {
    render(<UserAvatar user={makeUser({ display_name: "Alice Smith" })} />);
    expect(screen.getByText("AS")).toBeDefined();
  });

  it("renders single initial for single name", () => {
    render(<UserAvatar user={makeUser({ display_name: "Alice" })} />);
    expect(screen.getByText("A")).toBeDefined();
  });

  it("uses user color as background", () => {
    const { container } = render(
      <UserAvatar user={makeUser({ color: "#123abc" })} />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(18, 58, 188)");
  });

  it("uses default color when color is undefined", () => {
    const { container } = render(
      <UserAvatar user={makeUser({ color: undefined })} />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(99, 102, 241)");
  });

  it("shows title with display name", () => {
    render(<UserAvatar user={makeUser({ display_name: "Bob" })} />);
    expect(screen.getByTitle("Bob")).toBeDefined();
  });

  it("applies sm size class", () => {
    const { container } = render(
      <UserAvatar user={makeUser()} size="sm" />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-6");
  });
});

describe("Cursors", () => {
  it("renders nothing for current user", () => {
    const { container } = render(
      <Cursors users={[makeUser({ user_id: "me", cursor_path: "/A" })]} currentUserId="me" />
    );
    expect(container.querySelector(".collab-cursor")).toBeNull();
  });

  it("renders nothing for users without cursor_path", () => {
    const { container } = render(
      <Cursors
        users={[makeUser({ user_id: "other", cursor_path: undefined })]}
        currentUserId="me"
      />
    );
    expect(container.querySelector(".collab-cursor")).toBeNull();
  });

  it("renders cursor for other user with cursor_path", () => {
    const { container } = render(
      <Cursors
        users={[makeUser({ user_id: "other", display_name: "Bob", cursor_path: "/A" })]}
        currentUserId="me"
      />
    );
    expect(container.querySelector(".collab-cursor")).not.toBeNull();
    expect(screen.getByText("Bob")).toBeDefined();
  });
});

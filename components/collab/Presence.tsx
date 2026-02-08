"use client";

import { cn } from "@/lib/utils";
import type { User } from "@/lib/collab/client";

interface PresenceProps {
  users: User[];
  currentUserId: string;
}

export function Presence({ users, currentUserId }: PresenceProps) {
  const otherUsers = users.filter((u) => u.user_id !== currentUserId);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {/* Show up to 3 avatars */}
      {otherUsers.slice(0, 3).map((user) => (
        <UserAvatar key={user.user_id} user={user} />
      ))}

      {/* Show count if more than 3 */}
      {otherUsers.length > 3 && (
        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium">
          +{otherUsers.length - 3}
        </div>
      )}
    </div>
  );
}

interface UserAvatarProps {
  user: User;
  size?: "sm" | "md";
}

export function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium text-white",
        size === "sm" ? "w-6 h-6 text-xs" : "w-7 h-7 text-xs"
      )}
      style={{ backgroundColor: user.color || "#6366f1" }}
      title={user.display_name}
    >
      {initials}
    </div>
  );
}

interface CursorsProps {
  users: User[];
  currentUserId: string;
}

export function Cursors({ users, currentUserId }: CursorsProps) {
  const otherUsers = users.filter(
    (u) => u.user_id !== currentUserId && u.cursor_path
  );

  return (
    <>
      {otherUsers.map((user) => (
        <CollabCursor key={user.user_id} user={user} />
      ))}
    </>
  );
}

interface CollabCursorProps {
  user: User;
}

function CollabCursor({ user }: CollabCursorProps) {
  // This is a placeholder - in a real implementation,
  // you'd position this based on the cursor_path and element positions
  return (
    <div className="collab-cursor">
      <div
        className="collab-cursor-caret"
        style={{ backgroundColor: user.color || "#6366f1" }}
      />
      <div
        className="collab-cursor-label"
        style={{ backgroundColor: user.color || "#6366f1" }}
      >
        {user.display_name}
      </div>
    </div>
  );
}

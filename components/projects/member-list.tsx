"use client";

import { useState } from "react";
import { MoreVertical, Shield, Pencil, Eye, UserMinus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectMember, ProjectRole, MemberUpdate } from "@/lib/api/projects";

interface MemberListProps {
  members: ProjectMember[];
  currentUserId: string;
  currentUserRole: ProjectRole;
  onUpdateRole: (userId: string, data: MemberUpdate) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

const roleIcons: Record<ProjectRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

const roleLabels: Record<ProjectRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const roleColors: Record<ProjectRole, string> = {
  owner: "text-purple-600 dark:text-purple-400",
  admin: "text-blue-600 dark:text-blue-400",
  editor: "text-green-600 dark:text-green-400",
  viewer: "text-slate-600 dark:text-slate-400",
};

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onRemove,
  isLoading = false,
}: MemberListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";

  const canEditMember = (member: ProjectMember): boolean => {
    if (!canManageMembers) return false;
    if (member.role === "owner") return false;
    if (currentUserRole === "admin" && member.role === "admin") return false;
    return true;
  };

  const canRemoveMember = (member: ProjectMember): boolean => {
    // Users can always remove themselves (except owner)
    if (member.user_id === currentUserId && member.role !== "owner") return true;
    return canEditMember(member);
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    setProcessingId(userId);
    setOpenMenuId(null);
    try {
      await onUpdateRole(userId, { role: newRole });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setProcessingId(userId);
    setOpenMenuId(null);
    try {
      await onRemove(userId);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-700">
      {members.map((member) => {
        const RoleIcon = roleIcons[member.role];
        const isProcessing = processingId === member.user_id;
        const isMenuOpen = openMenuId === member.user_id;

        return (
          <div
            key={member.id}
            className={cn(
              "flex items-center justify-between py-4",
              isProcessing && "opacity-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {member.user?.name
                  ? member.user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : member.user_id.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {member.user?.name || member.user_id}
                  {member.user_id === currentUserId && (
                    <span className="ml-2 text-sm text-slate-500">(you)</span>
                  )}
                </p>
                {member.user?.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {member.user.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={cn("flex items-center gap-1.5", roleColors[member.role])}>
                <RoleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{roleLabels[member.role]}</span>
              </div>

              {(canEditMember(member) || canRemoveMember(member)) && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setOpenMenuId(isMenuOpen ? null : member.user_id)}
                    disabled={isLoading || isProcessing}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>

                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        {canEditMember(member) && (
                          <>
                            <p className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Change role
                            </p>
                            {(["admin", "editor", "viewer"] as const)
                              .filter(
                                (role) =>
                                  role !== member.role &&
                                  (currentUserRole === "owner" || role !== "admin")
                              )
                              .map((role) => {
                                const Icon = roleIcons[role];
                                return (
                                  <button
                                    key={role}
                                    onClick={() => handleRoleChange(member.user_id, role)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                  >
                                    <Icon className="h-4 w-4" />
                                    {roleLabels[role]}
                                  </button>
                                );
                              })}
                            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                          </>
                        )}
                        {canRemoveMember(member) && (
                          <button
                            onClick={() => handleRemove(member.user_id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <UserMinus className="h-4 w-4" />
                            {member.user_id === currentUserId
                              ? "Leave project"
                              : "Remove member"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

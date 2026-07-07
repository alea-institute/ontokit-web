"use client";

import { useState } from "react";
import { MoreVertical, Shield, Pencil, Eye, UserMinus, Crown, ArrowRightLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectMember, ProjectRole, MemberUpdate } from "@/lib/api/projects";

interface MemberListProps {
  members: ProjectMember[];
  currentUserId: string;
  currentUserRole: ProjectRole;
  isPublic?: boolean;
  onUpdateRole: (userId: string, data: MemberUpdate) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onTransferOwnership?: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

const roleIcons: Record<ProjectRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  suggester: Lightbulb,
  viewer: Eye,
};

const roleLabels: Record<ProjectRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  suggester: "Suggester",
  viewer: "Viewer",
};

const roleColors: Record<ProjectRole, string> = {
  owner: "text-purple-600 dark:text-purple-400",
  admin: "text-blue-600 dark:text-blue-400",
  editor: "text-green-600 dark:text-green-400",
  suggester: "text-amber-600 dark:text-amber-400",
  viewer: "text-slate-600 dark:text-slate-400",
};

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  isPublic = false,
  onUpdateRole,
  onRemove,
  onTransferOwnership,
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

  const handleTransferOwnership = async (userId: string) => {
    if (!onTransferOwnership) return;
    setProcessingId(userId);
    setOpenMenuId(null);
    try {
      await onTransferOwnership(userId);
    } finally {
      setProcessingId(null);
    }
  };

  const canTransferTo = (member: ProjectMember): boolean => {
    return (
      currentUserRole === "owner" &&
      member.role === "admin" &&
      !!onTransferOwnership
    );
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

              {member.role === "editor" && canManageMembers && (
                <label
                  className="flex min-h-[44px] cursor-pointer items-center gap-2"
                  title="Allow this editor to merge structural PRs directly"
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400">Structural self-merge</span>
                  <div className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={member.can_self_merge_structural ?? false}
                      disabled={isLoading || isProcessing}
                      onChange={() =>
                        onUpdateRole(member.user_id, {
                          role: member.role,
                          can_self_merge_structural: !(member.can_self_merge_structural ?? false),
                        })
                      }
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full dark:bg-slate-600 dark:peer-checked:bg-primary-500" />
                  </div>
                </label>
              )}

              {(canEditMember(member) || canRemoveMember(member) || canTransferTo(member)) && (
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
                            {(["admin", "editor", "suggester", "viewer"] as const)
                              .filter(
                                (role) =>
                                  role !== member.role &&
                                  (currentUserRole === "owner" || role !== "admin") &&
                                  (!isPublic || role !== "viewer")
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
                        {canTransferTo(member) && (
                          <>
                            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                            <button
                              onClick={() => handleTransferOwnership(member.user_id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              Transfer Ownership
                            </button>
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

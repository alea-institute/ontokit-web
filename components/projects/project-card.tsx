"use client";

import Link from "next/link";
import { Globe, Lock, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Project } from "@/lib/api/projects";

interface ProjectCardProps {
  project: Project;
  className?: string;
}

export function ProjectCard({ project, className }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}/editor`}
      aria-label={`Open project ${project.name} editor`}
      className={cn(
        "block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all",
        "hover:border-primary-300 hover:shadow-md",
        "dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-600",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              {project.description}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            project.is_public
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          )}
          title={project.is_public ? "Public project" : "Private project"}
        >
          {project.is_public ? (
            <Globe className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>
            {project.member_count} {project.member_count === 1 ? "member" : "members"}
          </span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>Updated {formatDate(project.updated_at || project.created_at)}</span>
      </div>

      {(project.user_role || project.is_exemplar) && (
        <div className="mt-3 flex items-center gap-2">
          {project.is_exemplar && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              Exemplar
            </span>
          )}
          {project.user_role && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                {
                  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400":
                    project.user_role === "owner",
                  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400":
                    project.user_role === "admin",
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400":
                    project.user_role === "editor",
                  "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300":
                    project.user_role === "viewer",
                }
              )}
            >
              {project.user_role.charAt(0).toUpperCase() + project.user_role.slice(1)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

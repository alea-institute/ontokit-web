import { cn } from "@/lib/utils";

interface LLMRoleBadgeProps {
  roleLimitLabel: string | null;
  userRole?: string | null;
}

export function LLMRoleBadge({ roleLimitLabel, userRole }: LLMRoleBadgeProps) {
  if (!roleLimitLabel) return null;

  const roleColorClasses = getRoleColorClasses(userRole ?? "");

  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-semibold",
        roleColorClasses
      )}
      aria-label={`Your LLM access: ${roleLimitLabel}`}
    >
      {roleLimitLabel}
    </span>
  );
}

function getRoleColorClasses(role: string): string {
  switch (role) {
    case "owner":
    case "admin":
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
    case "editor":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "suggester":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      // Fallback — shouldn't reach here since roleLimitLabel is null for viewer/anon
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
  }
}

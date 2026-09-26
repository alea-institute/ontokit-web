import Link from "next/link";
import { FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoOntologyFileEmptyStateProps {
  projectId: string;
  /** False when project settings cannot be used, e.g. auth-disabled mode, where
   *  every settings read and action needs a token that never exists. */
  settingsAvailable: boolean;
  /** Only managers are offered a way to add an ontology file. */
  canManage: boolean;
}

/**
 * Full-height "No Ontology File" state shared by the project viewer and the
 * editor. Managers are pointed at project settings when those are usable, and
 * at importing a new project when they are not.
 */
export function NoOntologyFileEmptyState({ projectId, settingsAvailable, canManage }: NoOntologyFileEmptyStateProps) {
  return (
    <div className="flex h-[calc(100vh-4rem-3.5rem)] items-center justify-center">
      <div className="text-center">
        <FileCode className="mx-auto h-16 w-16 text-slate-400" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">No Ontology File</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          This project doesn&apos;t have an ontology file yet.
        </p>
        {canManage && settingsAvailable && (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
              Import an ontology file from the project settings.
            </p>
            <Link href={`/projects/${projectId}/settings`} className="mt-6 inline-block">
              <Button variant="outline">Go to Settings</Button>
            </Link>
          </>
        )}
        {canManage && !settingsAvailable && (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
              Project settings are unavailable in this configuration, so an ontology file can&apos;t be added here. Import one as a new project instead.
            </p>
            <Link href="/projects/new" className="mt-6 inline-block">
              <Button variant="outline">Import a new project</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

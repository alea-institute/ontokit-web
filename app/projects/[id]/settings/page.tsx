"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Trash2, Tag, Check, Github, GitPullRequest, AlertCircle, FileText, RefreshCw, History, Play } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { MemberList } from "@/components/projects/member-list";
import { LabelPreferences } from "@/components/projects/label-preferences";
import {
  projectApi,
  type Project,
  type ProjectMember,
  type ProjectUpdate,
  type MemberCreate,
  type MemberUpdate,
} from "@/lib/api/projects";
import {
  githubIntegrationApi,
  prSettingsApi,
  type GitHubIntegration,
  type PRSettings,
} from "@/lib/api/pullRequests";
import {
  normalizationApi,
  type NormalizationStatusResponse,
  type NormalizationRunResponse,
} from "@/lib/api/normalization";
import { cn } from "@/lib/utils";

export default function ProjectSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add member form state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Label preferences state
  const [labelPreferences, setLabelPreferences] = useState<string[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Normalization state
  const [normalizationStatus, setNormalizationStatus] = useState<NormalizationStatusResponse | null>(null);
  const [normalizationHistory, setNormalizationHistory] = useState<NormalizationRunResponse[]>([]);
  const [isCheckingNormalization, setIsCheckingNormalization] = useState(false);
  const [isRunningNormalization, setIsRunningNormalization] = useState(false);
  const [showNormalizationHistory, setShowNormalizationHistory] = useState(false);

  // GitHub integration state
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null);
  const [prSettings, setPrSettings] = useState<PRSettings | null>(null);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [githubRepoOwner, setGithubRepoOwner] = useState("");
  const [githubRepoName, setGithubRepoName] = useState("");
  const [githubInstallationId, setGithubInstallationId] = useState("");
  const [isSetupGitHub, setIsSetupGitHub] = useState(false);
  const [prApprovalRequired, setPrApprovalRequired] = useState(0);
  const [isSavingPrSettings, setIsSavingPrSettings] = useState(false);

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const [projectData, membersData] = await Promise.all([
          projectApi.get(projectId, session.accessToken),
          projectApi.listMembers(projectId, session.accessToken),
        ]);
        setProject(projectData);
        setMembers(membersData.items);
        setLabelPreferences(projectData.label_preferences || []);

        // Fetch normalization status if project has an ontology file
        if (projectData.source_file_path) {
          try {
            const normStatus = await normalizationApi.getStatus(projectId, session.accessToken);
            setNormalizationStatus(normStatus);
          } catch {
            // Normalization status may not be available, ignore
          }
        }

        // Fetch PR settings and GitHub integration for owners/admins/superadmins
        if (projectData.user_role === "owner" || projectData.user_role === "admin" || projectData.is_superadmin) {
          try {
            const prSettingsData = await prSettingsApi.get(projectId, session.accessToken);
            setPrSettings(prSettingsData);
            setGithubIntegration(prSettingsData.github_integration || null);
            setPrApprovalRequired(prSettingsData.pr_approval_required);
          } catch {
            // PR settings may not be available, ignore
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("403")) {
          setError("You don't have permission to access project settings");
        } else if (err instanceof Error && err.message.includes("404")) {
          setError("Project not found");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && projectId && isAuthenticated) {
      fetchData();
    } else if (status !== "loading" && !isAuthenticated) {
      setError("You must be signed in to access project settings");
      setIsLoading(false);
    }
  }, [projectId, session?.accessToken, status, isAuthenticated]);

  const canManage =
    project?.user_role === "owner" || project?.user_role === "admin" || project?.is_superadmin;
  const isOwner = project?.user_role === "owner";

  const handleUpdateProject = async (data: { name: string; description?: string; is_public: boolean }) => {
    if (!session?.accessToken || !project) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await projectApi.update(project.id, data as ProjectUpdate, session.accessToken);
      setProject(updated);
      setSuccessMessage("Project settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !project || !newMemberEmail.trim()) return;

    setIsAddingMember(true);
    setAddMemberError(null);

    try {
      // Note: In a real app, you'd need to look up the user by email to get their ID
      // For now, we'll use the email as a placeholder for the user_id
      const memberData: MemberCreate = {
        user_id: newMemberEmail.trim(), // This should be resolved to actual user ID
        role: newMemberRole,
      };
      const newMember = await projectApi.addMember(
        project.id,
        memberData,
        session.accessToken
      );
      setMembers([...members, newMember]);
      setProject({ ...project, member_count: project.member_count + 1 });
      setShowAddMember(false);
      setNewMemberEmail("");
      setNewMemberRole("viewer");
      setSuccessMessage("Member added successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setAddMemberError(
        err instanceof Error ? err.message : "Failed to add member"
      );
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, data: MemberUpdate) => {
    if (!session?.accessToken || !project) return;

    try {
      const updated = await projectApi.updateMember(
        project.id,
        userId,
        data,
        session.accessToken
      );
      setMembers(members.map((m) => (m.user_id === userId ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member role");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!session?.accessToken || !project) return;

    try {
      await projectApi.removeMember(project.id, userId, session.accessToken);
      setMembers(members.filter((m) => m.user_id !== userId));
      setProject({ ...project, member_count: project.member_count - 1 });

      // If user removed themselves, redirect to projects
      if (userId === session.user?.id) {
        router.push("/projects");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleDeleteProject = async () => {
    if (!session?.accessToken || !project || deleteConfirmText !== project.name)
      return;

    setIsDeleting(true);

    try {
      await projectApi.delete(project.id, session.accessToken);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      setIsDeleting(false);
    }
  };

  const handleSaveLabelPreferences = async () => {
    if (!session?.accessToken || !project) return;

    setIsSavingPreferences(true);
    setPreferencesSaved(false);
    setError(null);

    try {
      const updated = await projectApi.update(
        project.id,
        { label_preferences: labelPreferences },
        session.accessToken
      );
      setProject(updated);
      setPreferencesSaved(true);
      setTimeout(() => setPreferencesSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save label preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleSetupGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !project) return;

    setIsSetupGitHub(true);
    setError(null);

    try {
      const integration = await githubIntegrationApi.create(
        project.id,
        {
          repo_owner: githubRepoOwner,
          repo_name: githubRepoName,
          installation_id: parseInt(githubInstallationId, 10),
        },
        session.accessToken
      );
      setGithubIntegration(integration);
      setShowGitHubSetup(false);
      setGithubRepoOwner("");
      setGithubRepoName("");
      setGithubInstallationId("");
      setSuccessMessage("GitHub integration configured successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup GitHub integration");
    } finally {
      setIsSetupGitHub(false);
    }
  };

  const handleRemoveGitHub = async () => {
    if (!session?.accessToken || !project) return;
    if (!confirm("Are you sure you want to remove GitHub integration?")) return;

    try {
      await githubIntegrationApi.delete(project.id, session.accessToken);
      setGithubIntegration(null);
      setSuccessMessage("GitHub integration removed");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove GitHub integration");
    }
  };

  const handleSavePrSettings = async () => {
    if (!session?.accessToken || !project) return;

    setIsSavingPrSettings(true);
    setError(null);

    try {
      const updated = await prSettingsApi.update(
        project.id,
        { pr_approval_required: prApprovalRequired },
        session.accessToken
      );
      setPrSettings(updated);
      setSuccessMessage("PR settings saved");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save PR settings");
    } finally {
      setIsSavingPrSettings(false);
    }
  };

  const handleCheckNormalization = async () => {
    if (!session?.accessToken || !project) return;

    setIsCheckingNormalization(true);
    setError(null);

    try {
      const status = await normalizationApi.getStatus(project.id, session.accessToken);
      setNormalizationStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check normalization status");
    } finally {
      setIsCheckingNormalization(false);
    }
  };

  const handleRunNormalization = async (dryRun: boolean = false) => {
    if (!session?.accessToken || !project) return;

    setIsRunningNormalization(true);
    setError(null);

    try {
      const result = await normalizationApi.runNormalization(
        project.id,
        dryRun,
        session.accessToken
      );

      if (dryRun) {
        // Just update the preview
        setNormalizationStatus({
          needs_normalization: true,
          last_run: normalizationStatus?.last_run || null,
          last_run_id: normalizationStatus?.last_run_id || null,
          preview_report: result.report,
          error: null,
        });
        setSuccessMessage("Normalization preview generated");
      } else {
        // Refresh the status after running
        const newStatus = await normalizationApi.getStatus(project.id, session.accessToken);
        setNormalizationStatus(newStatus);
        setSuccessMessage("Normalization completed successfully");
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run normalization");
    } finally {
      setIsRunningNormalization(false);
    }
  };

  const handleLoadNormalizationHistory = async () => {
    if (!session?.accessToken || !project) return;

    try {
      const history = await normalizationApi.getHistory(project.id, 10, true, session.accessToken);
      setNormalizationHistory(history.items);
      setShowNormalizationHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load normalization history");
    }
  };

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error && !project) {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/projects"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>

            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error}
              </h2>
              <Link href="/projects" className="mt-4 inline-block">
                <Button variant="outline">Back to Projects</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!project || !canManage) {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-900/20">
              <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                Access Denied
              </h2>
              <p className="mt-2 text-amber-600 dark:text-amber-300">
                Only project owners and admins can access settings.
              </p>
              <Link href={`/projects/${projectId}`} className="mt-4 inline-block">
                <Button variant="outline">Back to Project</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href={`/projects/${projectId}`}
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Project Settings
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage your project settings and team members
            </p>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* General Settings */}
          <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              General
            </h2>
            <ProjectForm
              initialData={{
                name: project.name,
                description: project.description || "",
                is_public: project.is_public,
              }}
              onSubmit={handleUpdateProject}
              submitLabel="Save Changes"
              isLoading={isSaving}
            />
          </section>

          {/* Label Preferences Section - only show if project has an ontology */}
          {project.source_file_path && (
            <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Label Preferences
                </h2>
              </div>
              <LabelPreferences
                preferences={labelPreferences}
                onChange={setLabelPreferences}
                disabled={isSavingPreferences}
              />
              <div className="mt-4 flex items-center justify-end gap-3">
                {preferencesSaved && (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    Preferences saved
                  </span>
                )}
                <Button
                  onClick={handleSaveLabelPreferences}
                  disabled={isSavingPreferences}
                >
                  {isSavingPreferences ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </section>
          )}

          {/* Normalization Report Section - only show if project has an ontology with a report */}
          {project.normalization_report && (
            <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Import Normalization Report
                </h2>
              </div>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                When this ontology was imported, it was normalized to a canonical Turtle format
                to ensure consistent formatting and minimal diffs in future edits.
              </p>

              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Original Format</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {project.normalization_report.original_format}
                      {project.normalization_report.format_converted && (
                        <span className="ml-1 text-xs font-normal text-slate-500">→ Turtle</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Triple Count</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {project.normalization_report.triple_count.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Size Change</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {project.normalization_report.original_size_bytes.toLocaleString()} →{" "}
                      {project.normalization_report.normalized_size_bytes.toLocaleString()} bytes
                    </p>
                  </div>
                </div>

                {/* Prefix changes */}
                {(project.normalization_report.prefixes_removed.length > 0 ||
                  project.normalization_report.prefixes_added.length > 0) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <h3 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                      Prefix Changes
                    </h3>
                    {project.normalization_report.prefixes_removed.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Removed: </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {project.normalization_report.prefixes_removed.join(", ")}
                        </span>
                      </div>
                    )}
                    {project.normalization_report.prefixes_added.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Added: </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {project.normalization_report.prefixes_added.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {project.normalization_report.notes.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Changes Made
                    </h3>
                    <ul className="space-y-1">
                      {project.normalization_report.notes.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* On-Demand Normalization Section - only show if project has an ontology */}
          {project.source_file_path && (
            <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Ontology Normalization
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadNormalizationHistory}
                    disabled={isCheckingNormalization}
                  >
                    <History className="mr-1 h-4 w-4" />
                    History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckNormalization}
                    disabled={isCheckingNormalization}
                  >
                    {isCheckingNormalization ? (
                      <>
                        <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-4 w-4" />
                        Check Status
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                Normalization converts the ontology to a canonical Turtle format, ensuring consistent
                formatting and minimal diffs in future edits. You can run normalization at any time
                to clean up the source file.
              </p>

              {/* Status indicator */}
              {normalizationStatus && (
                <div className="mb-4">
                  {normalizationStatus.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Error checking status: {normalizationStatus.error}
                      </p>
                    </div>
                  ) : normalizationStatus.needs_normalization ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Normalization recommended
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        The ontology source file can be optimized for better formatting and smaller diffs.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Ontology is already normalized
                        </p>
                      </div>
                      {normalizationStatus.last_run && (
                        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                          Last normalized: {new Date(normalizationStatus.last_run).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Preview report if available */}
              {normalizationStatus?.preview_report && normalizationStatus.needs_normalization && (
                <div className="mb-4 space-y-3">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Preview of Changes
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Triple Count</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {normalizationStatus.preview_report.triple_count.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Size Change</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {normalizationStatus.preview_report.original_size_bytes.toLocaleString()} →{" "}
                        {normalizationStatus.preview_report.normalized_size_bytes.toLocaleString()} bytes
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Prefixes</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {normalizationStatus.preview_report.prefixes_removed.length > 0 && (
                          <span className="text-red-600">-{normalizationStatus.preview_report.prefixes_removed.length}</span>
                        )}
                        {normalizationStatus.preview_report.prefixes_removed.length > 0 &&
                          normalizationStatus.preview_report.prefixes_added.length > 0 && " / "}
                        {normalizationStatus.preview_report.prefixes_added.length > 0 && (
                          <span className="text-green-600">+{normalizationStatus.preview_report.prefixes_added.length}</span>
                        )}
                        {normalizationStatus.preview_report.prefixes_removed.length === 0 &&
                          normalizationStatus.preview_report.prefixes_added.length === 0 &&
                          "No changes"}
                      </p>
                    </div>
                  </div>

                  {normalizationStatus.preview_report.notes.length > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Changes</p>
                      <ul className="space-y-0.5">
                        {normalizationStatus.preview_report.notes.slice(0, 5).map((note, idx) => (
                          <li key={idx} className="text-xs text-slate-600 dark:text-slate-400">
                            • {note}
                          </li>
                        ))}
                        {normalizationStatus.preview_report.notes.length > 5 && (
                          <li className="text-xs text-slate-500 dark:text-slate-500">
                            ... and {normalizationStatus.preview_report.notes.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {canManage && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleRunNormalization(true)}
                    variant="outline"
                    disabled={isRunningNormalization}
                  >
                    Preview Changes
                  </Button>
                  <Button
                    onClick={() => handleRunNormalization(false)}
                    disabled={isRunningNormalization || !normalizationStatus?.needs_normalization}
                  >
                    {isRunningNormalization ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Normalization
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* History panel */}
              {showNormalizationHistory && normalizationHistory.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-600">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Normalization History
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNormalizationHistory(false)}
                    >
                      Close
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {normalizationHistory.map((run) => (
                      <div
                        key={run.id}
                        className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {run.trigger_type === "import" ? "Import" : run.trigger_type === "manual" ? "Manual" : "Automatic"}
                              {run.is_dry_run && (
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                  Preview
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(run.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            <p>{run.report.triple_count.toLocaleString()} triples</p>
                            {run.commit_hash && (
                              <p className="font-mono">{run.commit_hash.substring(0, 7)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Members Section */}
          <section
            id="members"
            className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Team Members
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </div>

            {/* Add Member Form */}
            {showAddMember && (
              <form
                onSubmit={handleAddMember}
                className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/50"
              >
                <h3 className="mb-3 font-medium text-slate-900 dark:text-white">
                  Add a new member
                </h3>
                {addMemberError && (
                  <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {addMemberError}
                  </div>
                )}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="User ID or email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    )}
                    disabled={isAddingMember}
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) =>
                      setNewMemberRole(e.target.value as "admin" | "editor" | "viewer")
                    }
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    )}
                    disabled={isAddingMember}
                  >
                    {isOwner && <option value="admin">Admin</option>}
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button type="submit" size="sm" disabled={isAddingMember || !newMemberEmail.trim()}>
                    {isAddingMember ? "Adding..." : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddMember(false);
                      setNewMemberEmail("");
                      setAddMemberError(null);
                    }}
                    disabled={isAddingMember}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <MemberList
              members={members}
              currentUserId={session?.user?.id || ""}
              currentUserRole={project.user_role!}
              onUpdateRole={handleUpdateMemberRole}
              onRemove={handleRemoveMember}
            />
          </section>

          {/* PR Settings Section - only for owners */}
          {isOwner && (
            <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Pull Request Settings
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="pr-approval"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Required Approvals
                  </label>
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    Minimum number of approvals required before a pull request can be merged.
                    Set to 0 to allow merging without approvals.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      id="pr-approval"
                      type="number"
                      min="0"
                      max="10"
                      value={prApprovalRequired}
                      onChange={(e) => setPrApprovalRequired(parseInt(e.target.value, 10) || 0)}
                      className={cn(
                        "w-20 rounded-md border px-3 py-2 text-sm",
                        "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                        "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      )}
                    />
                    <Button
                      onClick={handleSavePrSettings}
                      disabled={isSavingPrSettings}
                      size="sm"
                    >
                      {isSavingPrSettings ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* GitHub Integration Section - only for owners */}
          {isOwner && (
            <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <Github className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  GitHub Integration
                </h2>
              </div>

              {githubIntegration ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {githubIntegration.repo_owner}/{githubIntegration.repo_name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {githubIntegration.sync_enabled ? "Sync enabled" : "Sync disabled"}
                        </p>
                        {githubIntegration.last_sync_at && (
                          <p className="text-xs text-slate-400">
                            Last synced: {new Date(githubIntegration.last_sync_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={githubIntegration.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline"
                        >
                          View on GitHub
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveGitHub}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Pull requests created in Axigraph will be synced to GitHub.
                      Changes merged in GitHub will be reflected here automatically via webhooks.
                    </p>
                  </div>
                </div>
              ) : showGitHubSetup ? (
                <form onSubmit={handleSetupGitHub} className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Connect your project to a GitHub repository to sync pull requests.
                    You&apos;ll need to install the Axigraph GitHub App on your repository first.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Repository Owner
                      </label>
                      <input
                        type="text"
                        value={githubRepoOwner}
                        onChange={(e) => setGithubRepoOwner(e.target.value)}
                        placeholder="username or organization"
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-sm",
                          "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                          "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        )}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Repository Name
                      </label>
                      <input
                        type="text"
                        value={githubRepoName}
                        onChange={(e) => setGithubRepoName(e.target.value)}
                        placeholder="my-ontology"
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-sm",
                          "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                          "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        )}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Installation ID
                    </label>
                    <input
                      type="text"
                      value={githubInstallationId}
                      onChange={(e) => setGithubInstallationId(e.target.value)}
                      placeholder="12345678"
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-sm",
                        "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                        "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      )}
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Find this in your GitHub App installation settings
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSetupGitHub}>
                      {isSetupGitHub ? "Connecting..." : "Connect Repository"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowGitHubSetup(false);
                        setGithubRepoOwner("");
                        setGithubRepoName("");
                        setGithubInstallationId("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                    Connect to a GitHub repository to sync pull requests and enable collaborative workflows.
                  </p>
                  <Button variant="outline" onClick={() => setShowGitHubSetup(true)}>
                    <Github className="mr-2 h-4 w-4" />
                    Connect to GitHub
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Danger Zone */}
          {(isOwner || project?.is_superadmin) && (
            <section className="rounded-lg border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">
                Danger Zone
              </h2>

              {!showDeleteConfirm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Delete this project
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Once deleted, this project cannot be recovered.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Project
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                  <p className="mb-3 font-medium text-red-700 dark:text-red-400">
                    Are you sure you want to delete &quot;{project.name}&quot;?
                  </p>
                  <p className="mb-3 text-sm text-red-600 dark:text-red-300">
                    This action cannot be undone. Type{" "}
                    <strong>{project.name}</strong> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className={cn(
                      "mb-3 w-full rounded-md border px-3 py-2 text-sm",
                      "border-red-300 focus:border-red-500 focus:ring-red-500",
                      "dark:border-red-800 dark:bg-slate-800 dark:text-slate-100"
                    )}
                    placeholder={project.name}
                    disabled={isDeleting}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      onClick={handleDeleteProject}
                      disabled={isDeleting || deleteConfirmText !== project.name}
                    >
                      {isDeleting ? "Deleting..." : "Delete Project"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}

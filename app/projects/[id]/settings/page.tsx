"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Trash2, Tag, Check, Github, GitPullRequest, AlertCircle, FileText, RefreshCw, History, Play, Inbox, CheckCircle, XCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { MemberList } from "@/components/projects/member-list";
import { UserSearchInput } from "@/components/projects/user-search-input";
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
  userSettingsApi,
  type GitHubTokenStatus,
  type GitHubRepoInfo,
} from "@/lib/api/userSettings";
import {
  normalizationApi,
  type NormalizationStatusResponse,
  type NormalizationRunResponse,
} from "@/lib/api/normalization";
import {
  joinRequestApi,
  type JoinRequest as JoinRequestType,
} from "@/lib/api/joinRequests";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamically import the diff viewer to avoid SSR issues with Monaco
const NormalizationDiffViewer = dynamic(
  () => import("@/components/editor/NormalizationDiffViewer").then((mod) => mod.NormalizationDiffViewer),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-8 dark:bg-slate-800">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      </div>
    ),
  }
);

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
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "editor" | "viewer">("editor");
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
  const [showPreviewHighlight, setShowPreviewHighlight] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffContent, setDiffContent] = useState<{
    original: string;
    normalized: string;
  } | null>(null);
  // Background job state
  const [normalizationJobId, setNormalizationJobId] = useState<string | null>(null);
  const [normalizationJobStatus, setNormalizationJobStatus] = useState<string | null>(null);

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequestType[]>([]);
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [processingJoinRequest, setProcessingJoinRequest] = useState<string | null>(null);

  // GitHub integration state
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null);
  const [prSettings, setPrSettings] = useState<PRSettings | null>(null);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [isSetupGitHub, setIsSetupGitHub] = useState(false);
  const [prApprovalRequired, setPrApprovalRequired] = useState(0);
  const [isSavingPrSettings, setIsSavingPrSettings] = useState(false);

  // Repo picker state
  const [hasGithubToken, setHasGithubToken] = useState<boolean | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepoInfo[]>([]);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoInfo | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const repoSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

          // Fetch join requests for public projects
          if (projectData.is_public) {
            try {
              const jrData = await joinRequestApi.list(projectId, session.accessToken);
              setJoinRequests(jrData.items);
              setJoinRequestCount(jrData.total);
            } catch {
              // Join requests may not be available, ignore
            }
          }

          // Check if user has a GitHub token (for the repo picker)
          try {
            const tokenStatus = await userSettingsApi.getGitHubTokenStatus(session.accessToken);
            setHasGithubToken(tokenStatus.has_token);
          } catch {
            setHasGithubToken(false);
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

  // Scroll to hash on page load (for #normalization link from editor)
  useEffect(() => {
    if (!isLoading && typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const element = document.getElementById(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [isLoading]);

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
    if (!session?.accessToken || !project || !newMemberUserId) return;

    setIsAddingMember(true);
    setAddMemberError(null);

    try {
      const memberData: MemberCreate = {
        user_id: newMemberUserId,
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
      setNewMemberUserId("");
      setNewMemberRole("editor");
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

  const handleConnectRepo = async () => {
    if (!session?.accessToken || !project || !selectedRepo) return;

    setIsSetupGitHub(true);
    setError(null);

    try {
      const integration = await githubIntegrationApi.create(
        project.id,
        {
          repo_owner: selectedRepo.owner,
          repo_name: selectedRepo.name,
          default_branch: selectedRepo.default_branch,
          webhooks_enabled: false,
        },
        session.accessToken
      );
      setGithubIntegration(integration);
      setShowGitHubSetup(false);
      setSelectedRepo(null);
      setGithubRepos([]);
      setRepoSearchQuery("");
      setSuccessMessage("GitHub repository connected successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect repository");
    } finally {
      setIsSetupGitHub(false);
    }
  };

  const handleSearchRepos = (query: string) => {
    setRepoSearchQuery(query);
    setSelectedRepo(null);

    // Debounce search
    if (repoSearchTimeout.current) {
      clearTimeout(repoSearchTimeout.current);
    }

    repoSearchTimeout.current = setTimeout(async () => {
      if (!session?.accessToken) return;

      setIsLoadingRepos(true);
      try {
        const result = await userSettingsApi.listGitHubRepos(
          session.accessToken,
          query || undefined,
          1,
          20
        );
        setGithubRepos(result.items);
      } catch {
        setGithubRepos([]);
      } finally {
        setIsLoadingRepos(false);
      }
    }, 300);
  };

  // Load initial repos when setup panel opens
  useEffect(() => {
    if (showGitHubSetup && hasGithubToken && githubRepos.length === 0 && session?.accessToken) {
      setIsLoadingRepos(true);
      userSettingsApi
        .listGitHubRepos(session.accessToken, undefined, 1, 20)
        .then((result) => setGithubRepos(result.items))
        .catch(() => setGithubRepos([]))
        .finally(() => setIsLoadingRepos(false));
    }
  }, [showGitHubSetup, hasGithubToken, session?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleApproveJoinRequest = async (requestId: string) => {
    if (!session?.accessToken || !project) return;

    setProcessingJoinRequest(requestId);
    try {
      await joinRequestApi.approve(project.id, requestId, session.accessToken);
      setJoinRequests(joinRequests.filter((jr) => jr.id !== requestId));
      setJoinRequestCount(Math.max(0, joinRequestCount - 1));
      // Refresh member list
      const membersData = await projectApi.listMembers(project.id, session.accessToken);
      setMembers(membersData.items);
      setProject({ ...project, member_count: membersData.total });
      setSuccessMessage("Join request approved — user added as editor");
      setTimeout(() => setSuccessMessage(null), 3000);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setProcessingJoinRequest(null);
    }
  };

  const handleDeclineJoinRequest = async (requestId: string) => {
    if (!session?.accessToken || !project) return;

    setProcessingJoinRequest(requestId);
    try {
      await joinRequestApi.decline(project.id, requestId, session.accessToken);
      setJoinRequests(joinRequests.filter((jr) => jr.id !== requestId));
      setJoinRequestCount(Math.max(0, joinRequestCount - 1));
      setSuccessMessage("Join request declined");
      setTimeout(() => setSuccessMessage(null), 3000);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline request");
    } finally {
      setProcessingJoinRequest(null);
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
      if (dryRun) {
        // Dry runs can still be synchronous (just generates preview)
        const result = await normalizationApi.runNormalization(
          project.id,
          true,
          session.accessToken
        );

        // Update the preview status
        setNormalizationStatus({
          needs_normalization: true,
          last_run: normalizationStatus?.last_run || null,
          last_run_id: normalizationStatus?.last_run_id || null,
          last_check: new Date().toISOString(),
          preview_report: result.report,
          checking: false,
          error: null,
        });

        // Show the diff viewer if we have content
        if (result.original_content && result.normalized_content) {
          setDiffContent({
            original: result.original_content,
            normalized: result.normalized_content,
          });
          setShowDiffViewer(true);
        } else {
          // Fallback to highlighting the stats preview
          setShowPreviewHighlight(true);
          setTimeout(() => {
            previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          setTimeout(() => setShowPreviewHighlight(false), 2000);
        }
        setIsRunningNormalization(false);
      } else {
        // Actual normalization runs as a background job
        const queueResult = await normalizationApi.queueNormalization(
          project.id,
          false,
          session.accessToken
        );

        setNormalizationJobId(queueResult.job_id);
        setNormalizationJobStatus("queued");
        setSuccessMessage("Normalization job queued - processing in background...");

        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const jobStatus = await normalizationApi.getJobStatus(
              project.id,
              queueResult.job_id,
              session.accessToken
            );

            setNormalizationJobStatus(jobStatus.status);

            if (jobStatus.status === "complete") {
              clearInterval(pollInterval);
              setNormalizationJobId(null);
              setNormalizationJobStatus(null);
              setIsRunningNormalization(false);

              // Refresh status
              const newStatus = await normalizationApi.getStatus(project.id, session.accessToken);
              setNormalizationStatus(newStatus);
              setSuccessMessage("Normalization completed successfully");
              setTimeout(() => setSuccessMessage(null), 3000);
            } else if (jobStatus.status === "failed" || jobStatus.status === "not_found") {
              clearInterval(pollInterval);
              setNormalizationJobId(null);
              setNormalizationJobStatus(null);
              setIsRunningNormalization(false);
              setError(jobStatus.error || "Normalization job failed");
            }
          } catch (pollErr) {
            // Continue polling on error
            console.error("Error polling job status:", pollErr);
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup on unmount
        return () => clearInterval(pollInterval);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run normalization");
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
            <section
              id="normalization"
              className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
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

              {/* Background job status */}
              {normalizationJobId && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {normalizationJobStatus === "queued" && "Normalization job queued..."}
                      {normalizationJobStatus === "pending" && "Normalization job pending..."}
                      {normalizationJobStatus === "running" && "Normalizing ontology (this may take a while for large files)..."}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Job ID: {normalizationJobId}
                  </p>
                </div>
              )}

              {/* Preview report if available */}
              {normalizationStatus?.preview_report && normalizationStatus.needs_normalization && (
                <div
                  ref={previewRef}
                  className={`mb-4 space-y-3 rounded-lg border-2 p-4 transition-all duration-500 ${
                    showPreviewHighlight
                      ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20"
                      : "border-transparent"
                  }`}
                >
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
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handleRunNormalization(true)}
                      variant="outline"
                      disabled={isRunningNormalization || !!normalizationJobId}
                    >
                      Preview Changes
                    </Button>
                    <Button
                      onClick={() => handleRunNormalization(false)}
                      disabled={isRunningNormalization || !!normalizationJobId}
                      variant={normalizationStatus?.needs_normalization ? "primary" : "outline"}
                    >
                      {isRunningNormalization || normalizationJobId ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {normalizationJobStatus === "running" ? "Processing..." : "Queued..."}
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          {normalizationStatus?.needs_normalization
                            ? "Run Normalization"
                            : "Re-normalize"}
                        </>
                      )}
                    </Button>
                  </div>
                  {!normalizationStatus?.needs_normalization && !normalizationJobId && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Re-normalizing will apply canonical blank node identifiers for more stable diffs.
                    </p>
                  )}
                </div>
              )}

              {/* History panel */}
              {showNormalizationHistory && (
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
                  {normalizationHistory.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No normalization history yet.
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </section>
          )}

          {/* Join Requests Section - only for public projects */}
          {canManage && project.is_public && (
            <section
              id="join-requests"
              className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Join Requests
                  </h2>
                  {joinRequestCount > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {joinRequestCount}
                    </span>
                  )}
                </div>
              </div>

              {joinRequests.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No pending join requests.
                </p>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((jr) => (
                    <div
                      key={jr.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {jr.user?.name || jr.user?.email || jr.user_id}
                            </span>
                            {jr.user?.email && jr.user?.name && (
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                ({jr.user.email})
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-400">
                            &ldquo;{jr.message}&rdquo;
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Requested {new Date(jr.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveJoinRequest(jr.id)}
                            disabled={processingJoinRequest === jr.id}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeclineJoinRequest(jr.id)}
                            disabled={processingJoinRequest === jr.id}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                <div className="space-y-3">
                  <UserSearchInput
                    value={newMemberUserId}
                    onSelect={(userId) => setNewMemberUserId(userId)}
                    onClear={() => setNewMemberUserId("")}
                    token={session?.accessToken || ""}
                    disabled={isAddingMember}
                  />
                  <div className="flex items-center gap-3">
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
                      {!project.is_public && <option value="viewer">Viewer</option>}
                    </select>
                    <Button type="submit" size="sm" disabled={isAddingMember || !newMemberUserId}>
                      {isAddingMember ? "Adding..." : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddMember(false);
                        setNewMemberUserId("");
                        setAddMemberError(null);
                      }}
                      disabled={isAddingMember}
                    >
                      Cancel
                    </Button>
                  </div>
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
                          {!githubIntegration.connected_by_user_id && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Legacy — reconnect to enable sync
                            </span>
                          )}
                        </p>
                        {githubIntegration.ontology_file_path && (
                          <p className="text-xs text-slate-400">
                            Source file: {githubIntegration.ontology_file_path}
                          </p>
                        )}
                        {githubIntegration.turtle_file_path &&
                          githubIntegration.turtle_file_path !== githubIntegration.ontology_file_path && (
                          <p className="text-xs text-slate-400">
                            Turtle output: {githubIntegration.turtle_file_path}
                          </p>
                        )}
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

                  {/* Sync status indicator */}
                  {githubIntegration.sync_status === "idle" && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/20">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <p className="text-sm text-green-700 dark:text-green-300">In sync</p>
                    </div>
                  )}
                  {githubIntegration.sync_status === "syncing" && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/20">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">Syncing...</p>
                    </div>
                  )}
                  {githubIntegration.sync_status === "conflict" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                          Merge conflict detected
                        </p>
                      </div>
                      {githubIntegration.sync_error && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {githubIntegration.sync_error}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                        Sync is paused. Resolve the conflict by force-pushing from Axigraph or resetting to the remote version.
                      </p>
                    </div>
                  )}
                  {githubIntegration.sync_status === "error" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Sync error
                        </p>
                      </div>
                      {githubIntegration.sync_error && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          {githubIntegration.sync_error}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Pull requests created in Axigraph will be synced to GitHub.
                    </p>
                  </div>
                </div>
              ) : showGitHubSetup ? (
                <div className="space-y-4">
                  {hasGithubToken === false ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Connect your GitHub account first.{" "}
                        <Link href="/settings" className="font-medium underline">
                          Go to Settings
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Search for a repository to connect to this project.
                      </p>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Search repositories
                        </label>
                        <input
                          type="text"
                          value={repoSearchQuery}
                          onChange={(e) => handleSearchRepos(e.target.value)}
                          placeholder="Search by name..."
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm",
                            "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                            "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                          )}
                        />
                      </div>

                      {/* Repo list */}
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                        {isLoadingRepos ? (
                          <div className="flex items-center justify-center p-4">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                          </div>
                        ) : githubRepos.length === 0 ? (
                          <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            {repoSearchQuery ? "No repositories found" : "No repositories available"}
                          </p>
                        ) : (
                          githubRepos.map((repo) => (
                            <button
                              key={repo.full_name}
                              type="button"
                              onClick={() => setSelectedRepo(repo)}
                              className={cn(
                                "w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 dark:border-slate-700",
                                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                                selectedRepo?.full_name === repo.full_name &&
                                  "bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {repo.full_name}
                                    {repo.private && (
                                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                        Private
                                      </span>
                                    )}
                                  </p>
                                  {repo.description && (
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                      {repo.description}
                                    </p>
                                  )}
                                </div>
                                {selectedRepo?.full_name === repo.full_name && (
                                  <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleConnectRepo}
                          disabled={!selectedRepo || isSetupGitHub}
                        >
                          {isSetupGitHub ? "Connecting..." : "Connect Repository"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowGitHubSetup(false);
                            setSelectedRepo(null);
                            setGithubRepos([]);
                            setRepoSearchQuery("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
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

      {/* Normalization Diff Viewer Modal */}
      {showDiffViewer && diffContent && (
        <NormalizationDiffViewer
          originalContent={diffContent.original}
          normalizedContent={diffContent.normalized}
          onClose={() => {
            setShowDiffViewer(false);
            setDiffContent(null);
          }}
        />
      )}
    </>
  );
}

"use client";

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, UserPlus, Trash2, Tag, Check, GitPullRequest, AlertCircle, FileText, RefreshCw, History, Play, Inbox, CheckCircle, XCircle, Download, Copy, Eye, EyeOff, Database, ExternalLink, Shield } from "lucide-react";
import { GithubIcon as Github } from "@/components/icons/github";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { MemberList } from "@/components/projects/member-list";
import { UserSearchInput } from "@/components/projects/user-search-input";
import { LabelPreferences } from "@/components/projects/label-preferences";
import { ApiError, projectOntologyApi, type IndexStatusResponse, type IndexStatus } from "@/lib/api/client";
import { IndexWebSocketManager, type IndexWebSocketMessage } from "@/lib/api/indexStatus";
import {
  projectApi,
  type Project,
  type ProjectMember,
  type ProjectUpdate,
  type MemberCreate,
  type MemberUpdate,
  type MemberListResponse,
  type TransferOwnership,
} from "@/lib/api/projects";
import { TurtleOutputPicker } from "@/components/projects/turtle-output-picker";
import {
  githubIntegrationApi,
  prSettingsApi,
  type GitHubIntegration,
  type PRSettings,
} from "@/lib/api/pullRequests";
import {
  userSettingsApi,

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
import { useRemoteSync } from "@/lib/hooks/useRemoteSync";
import { useProject, projectQueryKeys } from "@/lib/hooks/useProject";
import { useMembers, memberQueryKeys } from "@/lib/hooks/useMembers";
import { useNormalizationStatus, normalizationQueryKeys } from "@/lib/hooks/useNormalizationStatus";
import { useIndexStatus, indexQueryKeys } from "@/lib/hooks/useIndexStatus";
import type {
  SyncFrequency,
  SyncUpdateMode,
} from "@/lib/api/remoteSync";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import {
  embeddingsApi,
  type EmbeddingConfig,
  type EmbeddingConfigUpdate,
  type EmbeddingProvider,
  type EmbeddingStatus,
} from "@/lib/api/embeddings";
import {
  lintApi,
  type LintConfig,
  type LintRuleInfo,
  type LintSummary,
} from "@/lib/api/lint";

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

  const queryClient = useQueryClient();

  // Keep a ref to the latest accessToken so polling closures never go stale
  const accessTokenRef = useRef(session?.accessToken);
  useEffect(() => {
    accessTokenRef.current = session?.accessToken;
  }, [session?.accessToken]);

  // React Query hooks for data (single source of truth — no local mirrors)
  const {
    project,
    isLoading: isProjectLoading,
    error: projectError,
  } = useProject(projectId, session?.accessToken);
  const { data: membersData } = useMembers(projectId, session?.accessToken);
  const members = membersData?.items ?? [];

  // Stable query key for optimistic updates via setQueryData
  const projectKey = projectQueryKeys.detail(projectId, !!session?.accessToken);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Derive displayed error: local mutation errors take priority, then query errors
  const error = localError || projectError || null;

  // Add member form state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "editor" | "suggester" | "viewer">("suggester");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Label preferences state
  const [labelPreferences, setLabelPreferences] = useState<string[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Normalization status via React Query
  const {
    data: normalizationQueryData,
  } = useNormalizationStatus(projectId, session?.accessToken, {
    enabled: !!project?.source_file_path && !!session?.accessToken,
  });
  // Local normalization state (for optimistic updates during dry run / normalization)
  const [normalizationStatus, setNormalizationStatus] = useState<NormalizationStatusResponse | null>(null);
  useEffect(() => {
    if (normalizationQueryData) setNormalizationStatus(normalizationQueryData);
  }, [normalizationQueryData]);

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
  const normalizationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ontology index status via React Query
  const {
    data: indexQueryData,
  } = useIndexStatus(projectId, session?.accessToken, {
    enabled: !!project?.source_file_path && !!session?.accessToken,
  });
  // Local index state (for optimistic updates during reindex)
  const [indexStatus, setIndexStatus] = useState<IndexStatusResponse | null>(null);
  useEffect(() => {
    if (indexQueryData) setIndexStatus(indexQueryData);
  }, [indexQueryData]);

  const [isReindexing, setIsReindexing] = useState(false);

  // WebSocket for real-time index status updates
  useEffect(() => {
    if (!project?.id || !session?.accessToken) return;

    const manager = new IndexWebSocketManager(
      project.id,
      (message: IndexWebSocketMessage) => {
        if (message.type === "index_started") {
          setIsReindexing(true);
          setIndexStatus((prev) =>
            prev ? { ...prev, status: "indexing" as IndexStatus } : prev
          );
        } else if (message.type === "index_complete" || message.type === "index_failed") {
          setIsReindexing(false);
          const token = accessTokenRef.current;
          queryClient.invalidateQueries({ queryKey: indexQueryKeys.status(projectId, token) });
        }
      },
      session.accessToken
    );

    // Small delay to avoid spurious connections during Strict Mode remounts
    const timeoutId = setTimeout(() => manager.connect(), 100);

    return () => {
      clearTimeout(timeoutId);
      manager.disconnect();
    };
  }, [project?.id, session?.accessToken, projectId, queryClient]);

  // Clean up normalization polling on unmount
  useEffect(() => {
    return () => {
      if (normalizationPollRef.current) {
        clearInterval(normalizationPollRef.current);
      }
    };
  }, []);

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequestType[]>([]);
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [processingJoinRequest, setProcessingJoinRequest] = useState<string | null>(null);

  // GitHub integration state
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null);
  const [, setPrSettings] = useState<PRSettings | null>(null);
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
  const [githubOutputPath, setGithubOutputPath] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";
  const isLoading = isProjectLoading || status === "loading";

  const canManage =
    project?.user_role === "owner" || project?.user_role === "admin" || project?.is_superadmin;
  const isOwner = project?.user_role === "owner";

  // Sync label preferences from project data
  useEffect(() => {
    if (project) {
      setLabelPreferences(project.label_preferences || []);
    }
  }, [project]);

  // Admin-only data via React Query (replaces manual useEffect fetch)
  const isPublic = project?.is_public;

  const prSettingsQuery = useQuery({
    queryKey: ["prSettings", projectId],
    queryFn: () => prSettingsApi.get(projectId, session!.accessToken!),
    enabled: !!canManage && !!session?.accessToken,
    retry: false,
  });
  useEffect(() => {
    if (prSettingsQuery.data) {
      setPrSettings(prSettingsQuery.data);
      setGithubIntegration(prSettingsQuery.data.github_integration || null);
      setPrApprovalRequired(prSettingsQuery.data.pr_approval_required);
    }
  }, [prSettingsQuery.data]);

  const joinRequestsQuery = useQuery({
    queryKey: ["joinRequests", projectId],
    queryFn: () => joinRequestApi.list(projectId, session!.accessToken!),
    enabled: !!isPublic && !!canManage && !!session?.accessToken,
    retry: false,
  });
  useEffect(() => {
    if (joinRequestsQuery.data) {
      setJoinRequests(joinRequestsQuery.data.items);
      setJoinRequestCount(joinRequestsQuery.data.total);
    }
  }, [joinRequestsQuery.data]);

  const githubTokenStatusQuery = useQuery({
    queryKey: ["githubTokenStatus", session?.user?.id],
    queryFn: () => userSettingsApi.getGitHubTokenStatus(session!.accessToken!),
    enabled: !!canManage && !!session?.accessToken,
    retry: false,
  });
  useEffect(() => {
    if (githubTokenStatusQuery.data) {
      setHasGithubToken(githubTokenStatusQuery.data.has_token);
    } else if (githubTokenStatusQuery.isError) {
      setHasGithubToken(false);
    }
  }, [githubTokenStatusQuery.data, githubTokenStatusQuery.isError]);

  // Handle unauthenticated state
  useEffect(() => {
    if (status !== "loading" && !isAuthenticated) {
      setLocalError("You must be signed in to access project settings");
    }
  }, [status, isAuthenticated]);

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

  // Remote sync hook
  const remoteSync = useRemoteSync({
    projectId,
    accessToken: session?.accessToken,
    enabled: canManage ?? false,
  });

  const handleUpdateProject = async (data: { name: string; description?: string; is_public: boolean }) => {
    if (!session?.accessToken || !project) return;

    setIsSaving(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      const updated = await projectApi.update(project.id, data as ProjectUpdate, session.accessToken);
      queryClient.setQueryData<Project>(projectKey, updated);
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
      queryClient.setQueryData<MemberListResponse>(memberQueryKeys.list(projectId), (old) =>
        old ? { ...old, items: [...old.items, newMember], total: old.total + 1 } : { items: [newMember], total: 1 }
      );
      queryClient.setQueryData<Project>(projectKey, (old) =>
        old ? { ...old, member_count: old.member_count + 1 } : undefined
      );
      setShowAddMember(false);
      setNewMemberUserId("");
      setNewMemberRole("suggester");
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
      queryClient.setQueryData<MemberListResponse>(memberQueryKeys.list(projectId), (old) =>
        old ? { ...old, items: old.items.map((m: ProjectMember) => m.user_id === userId ? updated : m) } : undefined
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to update member role");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!session?.accessToken || !project) return;

    try {
      await projectApi.removeMember(project.id, userId, session.accessToken);
      queryClient.setQueryData<MemberListResponse>(memberQueryKeys.list(projectId), (old) =>
        old ? { ...old, items: old.items.filter((m: ProjectMember) => m.user_id !== userId), total: old.total - 1 } : undefined
      );
      queryClient.setQueryData<Project>(projectKey, (old) =>
        old ? { ...old, member_count: old.member_count - 1 } : undefined
      );

      // If user removed themselves, redirect to projects
      if (userId === session.user?.id) {
        router.push("/");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleTransferOwnership = async (userId: string) => {
    if (!session?.accessToken || !project) return;

    const targetMember = members.find((m) => m.user_id === userId);
    const targetName = targetMember?.user?.name || userId;

    if (
      !confirm(
        `Are you sure you want to transfer ownership of "${project.name}" to ${targetName}? You will be demoted to admin.`
      )
    )
      return;

    try {
      const result = await projectApi.transferOwnership(
        project.id,
        { new_owner_id: userId } as TransferOwnership,
        session.accessToken
      );
      queryClient.setQueryData<MemberListResponse>(memberQueryKeys.list(projectId), (old) =>
        old ? { ...old, items: result.items } : { items: result.items, total: result.items.length }
      );
      // Refresh the project to get updated owner_id and user_role
      const updatedProject = await projectApi.get(project.id, session.accessToken);
      queryClient.setQueryData<Project>(projectKey, updatedProject);
      setSuccessMessage("Ownership transferred successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      // Handle 409: GitHub integration will be disconnected
      if (err instanceof ApiError && err.status === 409) {
        const confirmed = confirm(
          `${err.message}\n\nDo you want to proceed and disconnect the GitHub integration?`
        );
        if (!confirmed) return;

        // Retry with force=true
        try {
          const result = await projectApi.transferOwnership(
            project.id,
            { new_owner_id: userId } as TransferOwnership,
            session.accessToken,
            true
          );
          queryClient.setQueryData<MemberListResponse>(memberQueryKeys.list(projectId), (old) =>
            old ? { ...old, items: result.items } : { items: result.items, total: result.items.length }
          );
          const updatedProject = await projectApi.get(project.id, session.accessToken);
          queryClient.setQueryData<Project>(projectKey, updatedProject);
          setGithubIntegration(null);
          setSuccessMessage(
            "Ownership transferred. GitHub integration was disconnected because the new owner has no GitHub token."
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        } catch (retryErr) {
          setLocalError(
            retryErr instanceof Error ? retryErr.message : "Failed to transfer ownership"
          );
        }
        return;
      }

      setLocalError(
        err instanceof Error ? err.message : "Failed to transfer ownership"
      );
    }
  };

  const handleDeleteProject = async () => {
    if (!session?.accessToken || !project || deleteConfirmText !== project.name)
      return;

    setIsDeleting(true);

    try {
      await projectApi.delete(project.id, session.accessToken);
      router.push("/");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to delete project");
      setIsDeleting(false);
    }
  };

  const handleSaveLabelPreferences = async () => {
    if (!session?.accessToken || !project) return;

    setIsSavingPreferences(true);
    setPreferencesSaved(false);
    setLocalError(null);

    try {
      const updated = await projectApi.update(
        project.id,
        { label_preferences: labelPreferences },
        session.accessToken
      );
      queryClient.setQueryData<Project>(projectKey, updated);
      setPreferencesSaved(true);
      setTimeout(() => setPreferencesSaved(false), 3000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save label preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleConnectRepo = async () => {
    if (!session?.accessToken || !project || !selectedRepo) return;

    setIsSetupGitHub(true);
    setLocalError(null);

    try {
      const integration = await githubIntegrationApi.create(
        project.id,
        {
          repo_owner: selectedRepo.owner,
          repo_name: selectedRepo.name,
          default_branch: selectedRepo.default_branch,
          webhooks_enabled: false,
          ontology_file_path: githubOutputPath || undefined,
        },
        session.accessToken
      );
      setGithubIntegration(integration);
      setShowGitHubSetup(false);
      setSelectedRepo(null);
      setGithubRepos([]);
      setRepoSearchQuery("");
      setGithubOutputPath(null);
      setSuccessMessage("GitHub repository connected successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to connect repository");
    } finally {
      setIsSetupGitHub(false);
    }
  };

  const handleSearchRepos = (query: string) => {
    setRepoSearchQuery(query);
    setSelectedRepo(null);
    setGithubOutputPath(null);

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
      setLocalError(err instanceof Error ? err.message : "Failed to remove GitHub integration");
    }
  };

  const handleSavePrSettings = async () => {
    if (!session?.accessToken || !project) return;

    setIsSavingPrSettings(true);
    setLocalError(null);

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
      setLocalError(err instanceof Error ? err.message : "Failed to save PR settings");
    } finally {
      setIsSavingPrSettings(false);
    }
  };

  const handleApproveJoinRequest = async (requestId: string) => {
    if (!session?.accessToken || !project) return;

    setProcessingJoinRequest(requestId);
    try {
      await joinRequestApi.approve(project.id, requestId, session.accessToken);
      setJoinRequests(prev => prev.filter((jr) => jr.id !== requestId));
      setJoinRequestCount(prev => Math.max(0, prev - 1));
      // Refresh member list, project, and join requests via React Query
      queryClient.invalidateQueries({ queryKey: memberQueryKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKey });
      queryClient.invalidateQueries({ queryKey: ["joinRequests", projectId] });
      setSuccessMessage("Join request approved — user added as suggester");
      setTimeout(() => setSuccessMessage(null), 3000);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setProcessingJoinRequest(null);
    }
  };

  const handleDeclineJoinRequest = async (requestId: string) => {
    if (!session?.accessToken || !project) return;

    setProcessingJoinRequest(requestId);
    try {
      await joinRequestApi.decline(project.id, requestId, session.accessToken);
      setJoinRequests(prev => prev.filter((jr) => jr.id !== requestId));
      setJoinRequestCount(prev => Math.max(0, prev - 1));
      queryClient.invalidateQueries({ queryKey: ["joinRequests", projectId] });
      setSuccessMessage("Join request declined");
      setTimeout(() => setSuccessMessage(null), 3000);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to decline request");
    } finally {
      setProcessingJoinRequest(null);
    }
  };

  const handleReindex = async () => {
    if (!session?.accessToken || !project) return;

    setIsReindexing(true);
    setLocalError(null);

    try {
      await projectOntologyApi.reindex(project.id, session.accessToken);
      setIndexStatus((prev) =>
        prev ? { ...prev, status: "indexing" as IndexStatus } : prev
      );
      setSuccessMessage("Reindex job queued. The index will update in the background.");
      setTimeout(() => setSuccessMessage(null), 5000);
      // WebSocket will handle status updates automatically
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to trigger reindex");
      setIsReindexing(false);
    }
  };

  const handleCheckNormalization = async () => {
    if (!session?.accessToken || !project) return;

    setIsCheckingNormalization(true);
    setLocalError(null);

    try {
      const status = await normalizationApi.getStatus(project.id, session.accessToken);
      setNormalizationStatus(status);
      queryClient.invalidateQueries({ queryKey: normalizationQueryKeys.status(projectId, session.accessToken) });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to check normalization status");
    } finally {
      setIsCheckingNormalization(false);
    }
  };

  const handleRunNormalization = async (dryRun: boolean = false) => {
    if (!session?.accessToken || !project) return;

    setIsRunningNormalization(true);
    setLocalError(null);

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

        // Poll for completion (ref-based so useEffect cleanup can cancel, token from ref to avoid stale closure)
        normalizationPollRef.current = setInterval(async () => {
          try {
            const token = accessTokenRef.current;
            const jobStatus = await normalizationApi.getJobStatus(
              project.id,
              queueResult.job_id,
              token
            );

            setNormalizationJobStatus(jobStatus.status);

            if (jobStatus.status === "complete") {
              clearInterval(normalizationPollRef.current!);
              normalizationPollRef.current = null;
              setNormalizationJobId(null);
              setNormalizationJobStatus(null);
              setIsRunningNormalization(false);

              // Refresh status
              const newStatus = await normalizationApi.getStatus(project.id, token);
              setNormalizationStatus(newStatus);
              queryClient.invalidateQueries({ queryKey: normalizationQueryKeys.status(projectId, token) });
              setSuccessMessage("Normalization completed successfully");
              setTimeout(() => setSuccessMessage(null), 3000);
            } else if (jobStatus.status === "failed" || jobStatus.status === "not_found") {
              clearInterval(normalizationPollRef.current!);
              normalizationPollRef.current = null;
              setNormalizationJobId(null);
              setNormalizationJobStatus(null);
              setIsRunningNormalization(false);
              setLocalError(jobStatus.error || "Normalization job failed");
            }
          } catch (pollErr) {
            // Continue polling on error
            console.error("Error polling job status:", pollErr);
          }
        }, 2000); // Poll every 2 seconds
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to run normalization");
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
      setLocalError(err instanceof Error ? err.message : "Failed to load normalization history");
    }
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>

            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error}
              </h2>
              <Link href="/" className="mt-4 inline-block">
                <Button variant="outline">Back to Projects</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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

  if (!canManage) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href={`/projects/${projectId}`}
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to project
            </Link>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Project Settings
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                View project configuration (read-only)
              </p>
            </div>
            {project.source_file_path ? (
              <LintConfigSection
                projectId={projectId}
                accessToken={session?.accessToken}
                canManage={false}
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No ontology source file has been configured for this project.
                </p>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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
            {project.exemplar_source_url && (
              <div className="mb-4 rounded-md bg-indigo-50 px-4 py-3 dark:bg-indigo-900/20">
                <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-400">
                  <Github className="h-4 w-4" />
                  <span className="font-medium">Exemplar ontology</span>
                  <span className="text-indigo-500 dark:text-indigo-500">—</span>
                  {isHttpUrl(project.exemplar_source_url) ? (
                    <a
                      href={project.exemplar_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      View remote source file
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-indigo-500">
                      {project.exemplar_source_url}
                    </span>
                  )}
                </div>
              </div>
            )}
            <ProjectForm
              initialData={{
                name: project.name,
                description: project.description || "",
                is_public: project.is_public,
              }}
              onSubmit={handleUpdateProject}
              submitLabel="Save Changes"
              isLoading={isSaving}
              disableVisibility={!!project.is_exemplar}
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
                                  <span className="ml-2 rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
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

          {/* Ontology Index Section - only for admins/owners with an ontology */}
          {canManage && project.source_file_path && (
            <section
              id="ontology-index"
              className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Ontology Search Index
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReindex}
                  disabled={isReindexing}
                >
                  {isReindexing ? (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                      Reindexing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Rebuild Index
                    </>
                  )}
                </Button>
              </div>

              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                The search index accelerates class tree navigation, entity search, and detail
                lookups by caching ontology structure in PostgreSQL. It is rebuilt automatically
                after imports and edits, but you can trigger a manual rebuild if results seem stale.
              </p>

              {/* Status indicator */}
              {indexStatus ? (
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {indexStatus.status === "ready" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {indexStatus.status === "indexing" && (
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {indexStatus.status === "pending" && (
                        <RefreshCw className="h-4 w-4 text-slate-400" />
                      )}
                      {indexStatus.status === "failed" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {indexStatus.status === "ready" && "Index up to date"}
                        {indexStatus.status === "indexing" && "Indexing in progress..."}
                        {indexStatus.status === "pending" && "Index pending"}
                        {indexStatus.status === "failed" && "Index failed"}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      {indexStatus.entity_count != null && (
                        <p>{indexStatus.entity_count.toLocaleString()} entities indexed</p>
                      )}
                      {indexStatus.indexed_at && (
                        <p>Last indexed: {new Date(indexStatus.indexed_at).toLocaleString()}</p>
                      )}
                      {indexStatus.commit_hash && (
                        <p className="font-mono">{indexStatus.commit_hash.substring(0, 7)}</p>
                      )}
                    </div>
                  </div>
                  {indexStatus.status === "failed" && indexStatus.error_message && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {indexStatus.error_message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No index status available. Click &quot;Rebuild Index&quot; to create the search index.
                  </p>
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
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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
                  <div className="mb-3 rounded-sm bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
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
                        setNewMemberRole(e.target.value as "admin" | "editor" | "suggester" | "viewer")
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
                      <option value="suggester">Suggester</option>
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
              isPublic={project.is_public}
              onUpdateRole={handleUpdateMemberRole}
              onRemove={handleRemoveMember}
              onTransferOwnership={isOwner ? handleTransferOwnership : undefined}
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
                            <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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

                  {/* PR sync info */}
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Pull requests created in OntoKit will be synced to GitHub.
                    </p>
                  </div>

                  {/* Webhook Configuration */}
                  <WebhookConfigPanel
                    projectId={projectId}
                    githubIntegration={githubIntegration}
                    accessToken={session?.accessToken}
                    onIntegrationUpdate={setGithubIntegration}
                  />

                  {/* Remote sync info (shown when webhooks enabled) */}
                  {githubIntegration.webhooks_enabled && (
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-900/20">
                      <Download className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <p className="text-blue-700 dark:text-blue-300">
                        Changes pushed to the remote repository will be synced back to OntoKit.
                      </p>
                    </div>
                  )}

                  {/* Sync status indicators */}
                  {githubIntegration.sync_status === "idle" && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/20">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <p className="text-sm text-green-700 dark:text-green-300">
                        In sync
                        {githubIntegration.ontology_file_path && (
                          <span className="ml-1 text-green-600 dark:text-green-400">
                            &mdash; {githubIntegration.ontology_file_path}
                          </span>
                        )}
                      </p>
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
                        Sync is paused. Resolve the conflict by force-pushing from OntoKit or resetting to the remote version.
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
                              onClick={() => {
                                setSelectedRepo(repo);
                                setGithubOutputPath(null);
                              }}
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
                                      <span className="ml-2 rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
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

                      {/* Turtle output path picker - shown after repo selection */}
                      {selectedRepo && session?.accessToken && (
                        <TurtleOutputPicker
                          owner={selectedRepo.owner}
                          repo={selectedRepo.name}
                          token={session.accessToken}
                          onSelect={(path) => setGithubOutputPath(path)}
                        />
                      )}

                      <div className="flex gap-3">
                        <Button
                          onClick={handleConnectRepo}
                          disabled={!selectedRepo || !githubOutputPath || isSetupGitHub}
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
                            setGithubOutputPath(null);
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

          {/* Sync from Remote - only for owners/admins */}
          {canManage && (
            <RemoteSyncSection
              projectId={projectId}
              remoteSync={remoteSync}
              githubIntegration={githubIntegration}
            />
          )}

          {/* Intelligence Features (Embeddings) */}
          {canManage && (
            <EmbeddingSettingsSection
              projectId={projectId}
              accessToken={session?.accessToken}
            />
          )}

          {/* Lint Rule Configuration - only for projects with an ontology */}
          {project.source_file_path && (
            <LintConfigSection
              projectId={projectId}
              accessToken={session?.accessToken}
              canManage={canManage ?? false}
            />
          )}

          {/* Danger Zone — hidden for exemplar projects unless superadmin */}
          {(isOwner || project?.is_superadmin) && !(project?.is_exemplar && !project?.is_superadmin) && (
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

// --- Webhook Configuration Panel ---

type WebhookStatus = "unknown" | "checking" | "configured" | "created" | "manual_required" | "no_scope" | "no_token" | "error";

function extractErrorDetail(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.detail) return String(parsed.detail);
      return err.message;
    } catch {
      return err.message || "An unexpected error occurred.";
    }
  }
  if (err instanceof Error) return err.message;
  return String(err) || "An unexpected error occurred.";
}

function WebhookConfigPanel({
  projectId,
  githubIntegration,
  accessToken,
  onIntegrationUpdate,
}: {
  projectId: string;
  githubIntegration: GitHubIntegration;
  accessToken?: string;
  onIntegrationUpdate: (integration: GitHubIntegration) => void;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const webhookSetupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>("unknown");
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // On mount: determine initial webhook status
  useEffect(() => {
    if (githubIntegration.webhooks_enabled && githubIntegration.github_hook_id) {
      setWebhookStatus("configured");
    } else if (githubIntegration.webhooks_enabled && !githubIntegration.github_hook_id) {
      setWebhookStatus("unknown");
    }
  }, [githubIntegration.webhooks_enabled, githubIntegration.github_hook_id]);

  // Clean up webhook setup timeout on unmount
  useEffect(() => {
    return () => {
      if (webhookSetupTimerRef.current) {
        clearTimeout(webhookSetupTimerRef.current);
      }
    };
  }, []);

  const runWebhookSetup = async () => {
    if (!accessToken) return;
    setWebhookStatus("checking");
    setWebhookMessage(null);
    try {
      const result = await githubIntegrationApi.setupWebhook(projectId, accessToken);
      setWebhookStatus(result.status as WebhookStatus);
      setWebhookMessage(result.message);
      if (result.github_hook_id) {
        onIntegrationUpdate({
          ...githubIntegration,
          github_hook_id: result.github_hook_id,
        });
      }
    } catch (err) {
      setWebhookStatus("error");
      setWebhookMessage(extractErrorDetail(err));
    }
  };

  const handleToggleWebhooks = async () => {
    if (!accessToken) return;
    setIsToggling(true);
    setError(null);
    try {
      const updated = await githubIntegrationApi.update(
        projectId,
        { webhooks_enabled: !githubIntegration.webhooks_enabled },
        accessToken
      );
      onIntegrationUpdate(updated);
      setShowManualFallback(false);
      // Clear state when disabling
      if (!updated.webhooks_enabled) {
        // Cancel any pending auto-setup from a prior enable
        if (webhookSetupTimerRef.current) {
          clearTimeout(webhookSetupTimerRef.current);
          webhookSetupTimerRef.current = null;
        }
        setWebhookSecret(null);
        setWebhookUrl(null);
        setWebhookStatus("unknown");
        setWebhookMessage(null);
      } else {
        // When enabling, attempt auto-setup
        setIsToggling(false);
        // Small delay to let state settle (stored in ref for unmount cleanup)
        webhookSetupTimerRef.current = setTimeout(async () => {
          try {
            const result = await githubIntegrationApi.setupWebhook(projectId, accessToken);
            setWebhookStatus(result.status as WebhookStatus);
            setWebhookMessage(result.message);
            if (result.github_hook_id) {
              onIntegrationUpdate({
                ...updated,
                github_hook_id: result.github_hook_id,
              });
            }
          } catch (err) {
            setWebhookStatus("error");
            setWebhookMessage(extractErrorDetail(err));
          }
        }, 100);
        return;
      }
    } catch (err) {
      setError(extractErrorDetail(err));
      // Show manual setup only when attempting to enable webhooks
      if (!githubIntegration.webhooks_enabled) {
        setShowManualFallback(true);
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleRevealSecret = async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const data = await githubIntegrationApi.getWebhookSecret(projectId, accessToken);
      setWebhookSecret(data.webhook_secret);
      setWebhookUrl(data.webhook_url);
      setShowSecret(true);
    } catch {
      setError("Failed to retrieve webhook secret");
    }
  };

  const copyToClipboard = async (text: string, type: "url" | "secret") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const fullWebhookUrl = webhookUrl ? `${apiBaseUrl}${webhookUrl}` : null;

  const showManualSetup = showManualFallback ||
    (githubIntegration.webhooks_enabled &&
      !["configured", "created", "checking"].includes(webhookStatus));

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Webhooks
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Receive push events from GitHub for instant sync from remote
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={githubIntegration.webhooks_enabled}
            onChange={handleToggleWebhooks}
            disabled={isToggling}
            className="peer sr-only"
          />
          <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-primary-300 dark:bg-slate-600 dark:peer-checked:bg-primary-500" />
        </label>
      </div>

      {(githubIntegration.webhooks_enabled || showManualFallback) && (
        <div className="mt-3 space-y-3">
          {/* Webhook auto-setup status */}
          {webhookStatus === "checking" && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              Checking webhook status...
            </div>
          )}

          {(webhookStatus === "configured" || webhookStatus === "created") && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5 dark:border-green-900/50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                {webhookStatus === "created"
                  ? "Webhook auto-created on GitHub"
                  : "Webhook configured on GitHub"}
              </p>
            </div>
          )}

          {webhookMessage && !["configured", "created"].includes(webhookStatus) && webhookStatus !== "checking" && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
              webhookStatus === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                : ["no_scope", "no_token", "manual_required"].includes(webhookStatus)
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400",
            )}>
              <AlertCircle className={cn(
                "mt-0.5 h-4 w-4 flex-shrink-0",
                webhookStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : ["no_scope", "no_token", "manual_required"].includes(webhookStatus)
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400",
              )} />
              <p className="text-xs">{webhookMessage}</p>
            </div>
          )}

          {/* Manual setup UI */}
          {showManualSetup && (
            <>
              {webhookStatus !== "unknown" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runWebhookSetup}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Retry auto-setup
                </Button>
              )}

              {webhookSecret === null ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevealSecret}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Show manual setup details
                </Button>
              ) : (
                <>
                  {/* Webhook URL */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Payload URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-sm bg-slate-100 px-2 py-1.5 text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {fullWebhookUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => fullWebhookUrl && copyToClipboard(fullWebhookUrl, "url")}
                      >
                        {copied === "url" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Webhook Secret */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Secret
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-sm bg-slate-100 px-2 py-1.5 text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {showSecret ? webhookSecret : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => webhookSecret && copyToClipboard(webhookSecret, "secret")}
                      >
                        {copied === "secret" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Setup instructions */}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add this URL and secret in your GitHub repository under{" "}
                    <span className="font-medium">Settings &rarr; Webhooks</span>.
                    Select <span className="font-medium">application/json</span> content type
                    and the <span className="font-medium">push</span> event.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                Failed to update webhook settings
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                  Show details
                </summary>
                <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Remote Sync Section ---

const FREQUENCY_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours" },
  { value: "48h", label: "Every 48 hours" },
  { value: "weekly", label: "Weekly" },
  { value: "manual", label: "Manual only" },
  { value: "webhook", label: "Webhook (instant)" },
];

const UPDATE_MODE_OPTIONS: { value: SyncUpdateMode; label: string; description: string }[] = [
  { value: "auto_apply", label: "Auto-apply if clean", description: "Automatically apply updates when there are no conflicts" },
  { value: "review_required", label: "Always create PR", description: "Create a pull request for every remote change" },
];

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatTimeUntil(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "any moment";
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${Math.floor(diffHrs / 24)}d`;
}

function RemoteSyncSection({
  projectId,
  remoteSync,
  githubIntegration,
}: {
  projectId: string;
  remoteSync: ReturnType<typeof useRemoteSync>;
  githubIntegration: GitHubIntegration | null;
}) {
  const {
    config,
    history,
    isLoading: isSyncLoading,
    isChecking,
    error: syncError,
    triggerCheck,
    saveConfig,
    deleteConfig,
  } = remoteSync;

  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(true);
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [filePath, setFilePath] = useState("");
  const [frequency, setFrequency] = useState<SyncFrequency>("24h");
  const [updateMode, setUpdateMode] = useState<SyncUpdateMode>("auto_apply");

  const isWebhookDriven = !!(githubIntegration?.webhooks_enabled && config?.frequency === "webhook");

  // Detect when remote sync points to the same repo as the GitHub integration
  const isLinkedToSameRepo = !!(
    githubIntegration &&
    ((config && config.repo_owner === githubIntegration.repo_owner && config.repo_name === githubIntegration.repo_name) ||
     (!config && !isEditing))
  );

  // Populate form from existing config, or autofill from GitHub integration
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setRepoOwner(config.repo_owner);
      setRepoName(config.repo_name);
      setBranch(config.branch);
      setFilePath(config.file_path);
      setFrequency(config.frequency);
      setUpdateMode(config.update_mode);
    } else if (githubIntegration) {
      setRepoOwner(githubIntegration.repo_owner);
      setRepoName(githubIntegration.repo_name);
      if (githubIntegration.default_branch) {
        setBranch(githubIntegration.default_branch);
      }
      if (githubIntegration.ontology_file_path) {
        setFilePath(githubIntegration.ontology_file_path);
      }
    }
  }, [config, githubIntegration]);

  const handleSave = async () => {
    setFormError(null);

    if (!repoOwner.trim() || !repoName.trim() || !filePath.trim()) {
      setFormError("Repository owner, name, and file path are required.");
      return;
    }

    setIsSaving(true);
    try {
      await saveConfig({
        repo_owner: repoOwner.trim(),
        repo_name: repoName.trim(),
        branch: branch.trim() || "main",
        file_path: filePath.trim(),
        frequency,
        enabled,
        update_mode: updateMode,
      });
      setIsEditing(false);
    } catch {
      // Error is set by the hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await deleteConfig();
      setIsEditing(false);
      setRepoOwner("");
      setRepoName("");
      setBranch("main");
      setFilePath("");
      setFrequency("24h");
      setUpdateMode("auto_apply");
      setEnabled(true);
    } catch {
      // Error is set by the hook
    } finally {
      setIsSaving(false);
    }
  };

  const eventIcon = (type: string) => {
    switch (type) {
      case "auto_applied":
        return <Download className="h-3.5 w-3.5 text-green-500" />;
      case "pr_created":
        return <GitPullRequest className="h-3.5 w-3.5 text-indigo-500" />;
      case "check_no_changes":
        return <CheckCircle className="h-3.5 w-3.5 text-slate-400" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <RefreshCw className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <section
      id="remote-sync"
      className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <Download className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Sync from Remote
        </h2>
      </div>

      {/* Clarification when tracking the same repo as GitHub integration */}
      {isLinkedToSameRepo && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Tracking the same repo as your GitHub integration</p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                This detects <strong>external changes</strong> pushed to GitHub outside of OntoKit
                (e.g. by CI pipelines, scripts, or other contributors). Commits that OntoKit itself
                pushed are automatically filtered out to prevent feedback loops.
              </p>
            </div>
          </div>
        </div>
      )}

      {isSyncLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : config && !isEditing ? (
        /* Configured state */
        <div className="space-y-4">
          {/* Config summary */}
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {config.repo_owner}/{config.repo_name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {config.file_path} · {config.branch} branch
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {config.enabled
                    ? config.frequency === "webhook"
                      ? "Webhook (instant)"
                      : `Checking ${FREQUENCY_OPTIONS.find((f) => f.value === config.frequency)?.label?.toLowerCase() || config.frequency}`
                    : "Disabled"}
                  {" · "}
                  {config.update_mode === "auto_apply"
                    ? "Auto-apply clean updates"
                    : "Always create PR"}
                </p>
                {githubIntegration?.webhooks_enabled && config.frequency === "webhook" && (
                  <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">
                    Automatically triggered by GitHub webhooks
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-sm"
                >
                  Edit
                </Button>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          {config.status === "up_to_date" && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-900/20">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Up to date
                {config.last_check_at && (
                  <span className="ml-1 text-green-600 dark:text-green-400">
                    &mdash; last checked {formatTimeAgo(config.last_check_at)}
                  </span>
                )}
              </p>
            </div>
          )}
          {config.status === "idle" && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/50">
              <div className="h-2 w-2 rounded-full bg-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Idle
                {config.last_check_at && (
                  <span className="ml-1 text-slate-500 dark:text-slate-400">
                    &mdash; last checked {formatTimeAgo(config.last_check_at)}
                  </span>
                )}
              </p>
            </div>
          )}
          {(config.status === "checking" || isChecking) && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/20">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Checking for remote changes...
              </p>
            </div>
          )}
          {config.status === "update_available" && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/20">
              <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Update available from remote
                {config.pending_pr_id && (
                  <span className="ml-1">
                    &mdash;{" "}
                    <a
                      href={`/projects/${projectId}/pull-requests/${config.pending_pr_id}`}
                      className="font-medium underline"
                    >
                      Review PR
                    </a>
                  </span>
                )}
              </p>
            </div>
          )}
          {config.status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Sync error
                </p>
              </div>
              {config.error_message && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {config.error_message}
                </p>
              )}
            </div>
          )}

          {/* Next check info */}
          {config.enabled && config.next_check_at && config.status !== "checking" && !isChecking && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Next check in {formatTimeUntil(config.next_check_at)}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerCheck()}
              disabled={isChecking || config.status === "checking"}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isChecking && "animate-spin")} />
              {isChecking ? "Checking..." : "Check Now"}
            </Button>

            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="mr-2 h-4 w-4" />
                {showHistory ? "Hide History" : "Recent Activity"}
              </Button>
            )}
          </div>

          {/* Error from hook */}
          {syncError && (
            <p className="text-sm text-red-600 dark:text-red-400">{syncError}</p>
          )}

          {/* History */}
          {showHistory && history.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="max-h-48 overflow-y-auto">
                {history.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 dark:border-slate-700"
                  >
                    <div className="mt-0.5">{eventIcon(event.event_type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {event.event_type === "check_no_changes" && "No changes found"}
                        {event.event_type === "auto_applied" && "Auto-applied update"}
                        {event.event_type === "pr_created" && "Created PR for review"}
                        {event.event_type === "update_found" && "Update found"}
                        {event.event_type === "error" && "Error"}
                      </p>
                      {event.changes_summary && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {event.changes_summary}
                        </p>
                      )}
                      {event.error_message && (
                        <p className="text-xs text-red-500 dark:text-red-400">
                          {event.error_message}
                        </p>
                      )}
                    </div>
                    <p className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {new Date(event.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Setup / edit form */
        <div className="space-y-4">
          {!config && !isEditing ? (
            <div>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                {githubIntegration
                  ? "Track the linked GitHub repository for changes made outside of OntoKit. When external updates are detected, they can be auto-applied or routed through a pull request. OntoKit's own commits are filtered out to prevent circular syncing."
                  : "Track an external GitHub repository for remote changes. When updates are detected, they can be auto-applied or routed through a pull request."}
              </p>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Download className="mr-2 h-4 w-4" />
                Configure Remote Source File
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {config ? "Edit remote source file configuration." : "Configure which external repository to track."}
              </p>

              {/* Enable toggle */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enable remote tracking
                </span>
              </label>

              {/* Repository */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Repository owner
                  </label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    readOnly={isWebhookDriven}
                    placeholder="e.g. alea-institute"
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                      isWebhookDriven && "cursor-not-allowed opacity-60"
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Repository name
                  </label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    readOnly={isWebhookDriven}
                    placeholder="e.g. FOLIO"
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                      isWebhookDriven && "cursor-not-allowed opacity-60"
                    )}
                  />
                </div>
              </div>

              {isWebhookDriven && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400">
                  Repository fields are managed by the GitHub integration.
                </p>
              )}

              {/* Same-repo info when editing form matches GitHub integration */}
              {!isWebhookDriven && githubIntegration &&
                repoOwner === githubIntegration.repo_owner &&
                repoName === githubIntegration.repo_name && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This is the same repository as your GitHub integration. Remote tracking will only
                  detect changes made outside of OntoKit &mdash; OntoKit&apos;s own pushes are excluded.
                </p>
              )}

              {/* Branch + File path */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    readOnly={isWebhookDriven}
                    placeholder="main"
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                      isWebhookDriven && "cursor-not-allowed opacity-60"
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    File path
                  </label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    readOnly={isWebhookDriven}
                    placeholder="e.g. FOLIO.owl"
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                      isWebhookDriven && "cursor-not-allowed opacity-60"
                    )}
                  />
                </div>
              </div>

              {/* Frequency + Update mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Check frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as SyncFrequency)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    )}
                  >
                    {FREQUENCY_OPTIONS.filter(
                      (opt) =>
                        opt.value !== "webhook" ||
                        githubIntegration?.webhooks_enabled
                    ).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    When updates found
                  </label>
                  <select
                    value={updateMode}
                    onChange={(e) => setUpdateMode(e.target.value as SyncUpdateMode)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm",
                      "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                      "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    )}
                  >
                    {UPDATE_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {UPDATE_MODE_OPTIONS.find((o) => o.value === updateMode)?.description}
                  </p>
                </div>
              </div>

              {/* Form errors */}
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
              {syncError && (
                <p className="text-sm text-red-600 dark:text-red-400">{syncError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : config ? "Update Configuration" : "Enable Tracking"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormError(null);
                    // Reset form to config values if cancelling
                    if (config) {
                      setEnabled(config.enabled);
                      setRepoOwner(config.repo_owner);
                      setRepoName(config.repo_name);
                      setBranch(config.branch);
                      setFilePath(config.file_path);
                      setFrequency(config.frequency);
                      setUpdateMode(config.update_mode);
                    }
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                {config && (
                  <Button
                    variant="ghost"
                    onClick={handleRemove}
                    disabled={isSaving}
                    className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const PROVIDER_OPTIONS: { value: EmbeddingProvider; label: string; description: string }[] = [
  { value: "local", label: "Local (CPU)", description: "all-MiniLM-L6-v2 — no API key needed" },
  { value: "openai", label: "OpenAI", description: "text-embedding-3-small" },
  { value: "voyage", label: "Voyage AI", description: "voyage-3-lite" },
  { value: "anthropic", label: "Anthropic", description: "voyager-instruct-3" },
];

const MODEL_DEFAULTS: Record<EmbeddingProvider, string> = {
  local: "all-MiniLM-L6-v2",
  openai: "text-embedding-3-small",
  voyage: "voyage-3-lite",
  anthropic: "voyager-instruct-3",
};

function EmbeddingSettingsSection({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const [config, setConfig] = useState<EmbeddingConfig | null>(null);
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Editable form state
  const [provider, setProvider] = useState<EmbeddingProvider>("local");
  const [apiKey, setApiKey] = useState("");
  const [autoEmbed, setAutoEmbed] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const [cfg, st] = await Promise.all([
          embeddingsApi.getConfig(projectId, accessToken).catch((err) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          }),
          embeddingsApi.getStatus(projectId, accessToken).catch((err) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          }),
        ]);
        if (cfg) {
          setConfig(cfg);
          setProvider(cfg.provider);
          setAutoEmbed(cfg.auto_embed_on_save);
        }
        if (st) {
          setStatus(st);
          // Resume polling if a job is already in progress
          if (st.job_in_progress) {
            setIsGenerating(true);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = setInterval(async () => {
              try {
                const updated = await embeddingsApi.getStatus(projectId, accessTokenRef.current!);
                setStatus(updated);
                if (!updated.job_in_progress) {
                  if (pollTimerRef.current) {
                    clearInterval(pollTimerRef.current);
                    pollTimerRef.current = null;
                  }
                  setIsGenerating(false);
                }
              } catch {
                // Ignore polling errors
              }
            }, 2000);
          }
        }
      } catch {
        // Config may not exist yet
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [projectId, accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;
    // Require API key when switching to a cloud provider without an existing key
    const requiresApiKey =
      provider !== "local" &&
      (!config?.api_key_set || config.provider !== provider) &&
      !apiKey.trim();
    if (requiresApiKey) {
      setError("API key is required for the selected provider");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const update: EmbeddingConfigUpdate = {
        provider,
        model_name: MODEL_DEFAULTS[provider],
        auto_embed_on_save: autoEmbed,
      };
      if (provider !== "local" && apiKey.trim()) {
        update.api_key = apiKey.trim();
      }
      const updated = await embeddingsApi.updateConfig(projectId, update, accessToken);
      setConfig(updated);
      setApiKey("");
      setSuccess("Embedding configuration saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!accessToken) return;
    setIsGenerating(true);
    setError(null);
    try {
      await embeddingsApi.triggerGeneration(projectId, accessToken);
      setSuccess("Embedding generation started");
      setTimeout(() => setSuccess(null), 3000);
      // Refresh status immediately
      const st = await embeddingsApi.getStatus(projectId, accessToken).catch(() => null);
      if (st) setStatus(st);
      // Start polling for progress updates
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const updated = await embeddingsApi.getStatus(projectId, accessTokenRef.current!);
          setStatus(updated);
          if (!updated.job_in_progress) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            setIsGenerating(false);
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setIsGenerating(false);
    }
  };

  const needsApiKey = provider !== "local";
  const coveragePercent = status?.coverage_percent ?? 0;

  return (
    <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Intelligence Features
        </h2>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
          Embeddings
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Generate vector embeddings to enable semantic search, similar entity discovery, and smart suggestions.
      </p>

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Embedding Provider
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProvider(opt.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    provider === opt.value
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-900/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                  )}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key input (only for cloud providers) */}
          {needsApiKey && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                API Key
                {config?.api_key_set && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                    (key set)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.api_key_set ? "Enter new key to replace" : "Enter API key"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          )}

          {/* Auto-embed toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoEmbed}
              onChange={(e) => setAutoEmbed(e.target.checked)}
              className="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Auto-embed on save (~50ms for local model)
            </span>
          </label>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>

            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || !config}
            >
              <Play className="mr-1.5 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Embeddings"}
            </Button>
          </div>

          {/* Coverage stats */}
          {status && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {status.embedded_entities} of {status.total_entities} entities embedded
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {Math.round(coveragePercent)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
              {status.job_in_progress && status.job_progress_percent != null && (
                <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                  Job in progress: {Math.round(status.job_progress_percent)}%
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          )}
        </div>
      )}
    </section>
  );
}

// --- Lint Level Presets ---

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

/** @deprecated Superseded by backend-driven levelRuleMap. Kept for test compatibility. */
export function getRulesForLevel(allRules: LintRuleInfo[], level: number): string[] {
  const maxOrder: Record<number, number> = {
    1: 0,                                                              // error only
    2: 1,                                                              // error + warning
    3: 2,                                                              // error + warning + info
    4: Math.max(...allRules.map((r) => SEVERITY_ORDER[r.severity] ?? 0), 0), // all known
    5: Number.POSITIVE_INFINITY,                                       // everything (future-proof)
  };

  const threshold = maxOrder[level];
  if (threshold === undefined) return [];

  return allRules
    .filter((r) => (SEVERITY_ORDER[r.severity] ?? Number.POSITIVE_INFINITY) <= threshold)
    .map((r) => r.rule_id);
}

export function getSeverityColor(severity: string) {
  switch (severity) {
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "info":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
}

export function LintConfigSection({
  projectId,
  accessToken,
  canManage,
}: {
  projectId: string;
  accessToken?: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable state
  const [lintLevel, setLintLevel] = useState<number>(2); // Default: Standard
  const [enabledRules, setEnabledRules] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Track saved state to detect changes
  const [savedLevel, setSavedLevel] = useState<number>(2);
  const [savedRules, setSavedRules] = useState<Set<string>>(new Set());

  // Fetch available lint rules
  const rulesQuery = useQuery({
    queryKey: ["lintRules"],
    queryFn: () => lintApi.getRules(),
    retry: false,
  });

  // Fetch lint level definitions from backend
  const levelsQuery = useQuery({
    queryKey: ["lintLevels"],
    queryFn: () => lintApi.getLevels(),
    retry: false,
  });

  // Build a map of level -> rule_ids from backend definitions
  const levelRuleMap = useMemo(() => {
    if (!levelsQuery.data) return new Map<number, Set<string>>();
    const map = new Map<number, Set<string>>();
    for (const level of levelsQuery.data.levels) {
      map.set(level.level, new Set(level.rule_ids));
    }
    return map;
  }, [levelsQuery.data]);

  const rules = useMemo(() => {
    if (!rulesQuery.data) return [];
    return [...rulesQuery.data.rules].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    );
  }, [rulesQuery.data]);

  // Fetch project lint config (depends on rules being loaded)
  const configQuery = useQuery({
    queryKey: ["lintConfig", projectId, accessToken],
    queryFn: () => lintApi.getLintConfig(projectId, accessToken),
    enabled: !!accessToken && rules.length > 0,
    retry: false,
  });

  // Fetch lint status summary
  const statusQuery = useQuery<LintSummary>({
    queryKey: ["lintSummary", projectId, accessToken],
    queryFn: () => lintApi.getStatus(projectId, accessToken),
    enabled: !!accessToken,
  });

  // Sync rules query error
  useEffect(() => {
    if (rulesQuery.isError) {
      setError("Failed to load lint rules");
    }
  }, [rulesQuery.isError]);

  // Sync config data into local editable state
  useEffect(() => {
    if (!configQuery.data && !configQuery.isError) return;
    // Don't overwrite in-progress edits from background refetches
    if (hasChanges) return;

    if (configQuery.data) {
      const cfg = configQuery.data;
      const level = cfg.lint_level ?? 0; // null means custom
      setLintLevel(level);
      setSavedLevel(level);
      if (level === 0) {
        const ruleSet = new Set(cfg.enabled_rules ?? []);
        setEnabledRules(ruleSet);
        setSavedRules(ruleSet);
      } else {
        const presetRules = levelRuleMap.get(level) ?? new Set<string>();
        setEnabledRules(presetRules);
        setSavedRules(presetRules);
      }
    } else if (configQuery.isError) {
      const err = configQuery.error;
      // Fall back to defaults only when config endpoint is missing (404/501)
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        const defaultRules = levelRuleMap.get(2) ?? new Set<string>();
        setEnabledRules(defaultRules);
        setSavedRules(defaultRules);
      } else {
        setError("Failed to load lint rules");
      }
    }
  }, [configQuery.data, configQuery.isError, configQuery.error, rules, levelRuleMap]);

  const isLoading = rulesQuery.isLoading || levelsQuery.isLoading || (!!accessToken && rules.length > 0 && configQuery.isLoading);

  // Detect changes
  useEffect(() => {
    if (lintLevel !== savedLevel) {
      setHasChanges(true);
      return;
    }
    if (lintLevel === 0) {
      // Custom mode: compare rule sets
      const currentIds = [...enabledRules].sort().join(",");
      const savedIds = [...savedRules].sort().join(",");
      setHasChanges(currentIds !== savedIds);
    } else {
      setHasChanges(false);
    }
  }, [lintLevel, enabledRules, savedLevel, savedRules]);

  const handleLevelChange = (level: number) => {
    setLintLevel(level);
    setError(null);
    setSuccess(null);
    if (level !== 0) {
      setEnabledRules(levelRuleMap.get(level) ?? new Set<string>());
    }
  };

  const handleRuleToggle = (ruleId: string) => {
    if (lintLevel !== 0) return; // Only toggle in custom mode
    setError(null);
    setSuccess(null);
    setEnabledRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const config: LintConfig = {
        lint_level: lintLevel === 0 ? null : lintLevel,
        enabled_rules: [...enabledRules],
      };
      await lintApi.updateLintConfig(projectId, config, accessToken);
      setSavedLevel(lintLevel);
      setSavedRules(new Set(enabledRules));
      setHasChanges(false);
      setSuccess("Lint configuration saved");
      // Invalidate queries so cache stays fresh
      queryClient.invalidateQueries({ queryKey: ["lintConfig", projectId] });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        setError("Backend lint config endpoint is not yet available");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save lint configuration");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearResults = async () => {
    if (!accessToken) return;
    setIsClearing(true);
    setError(null);
    setSuccess(null);
    try {
      await lintApi.clearResults(projectId, accessToken);
      setSuccess("Lint results cleared");
      queryClient.invalidateQueries({ queryKey: ["lintSummary", projectId] });
      queryClient.invalidateQueries({ queryKey: ["lintIssues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["lintRuns", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear lint results");
    } finally {
      setIsClearing(false);
    }
  };

  const isCustom = lintLevel === 0;

  return (
    <section
      id="lint-config"
      className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Lint Rule Configuration
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Configure which lint rules are applied during ontology health checks.
        Choose a preset level or customize individual rules.
      </p>

      {/* Last run summary */}
      {statusQuery.data?.last_run && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Last run: {new Date(statusQuery.data.last_run.completed_at || statusQuery.data.last_run.started_at).toLocaleString()}
              {statusQuery.data.last_run.status !== "completed" && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  ({statusQuery.data.last_run.status})
                </span>
              )}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {statusQuery.data.error_count > 0 && (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {statusQuery.data.error_count} error{statusQuery.data.error_count !== 1 && "s"}
                </span>
              )}
              {statusQuery.data.warning_count > 0 && (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {statusQuery.data.warning_count} warning{statusQuery.data.warning_count !== 1 && "s"}
                </span>
              )}
              {statusQuery.data.info_count > 0 && (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {statusQuery.data.info_count} info
                </span>
              )}
              {statusQuery.data.total_issues === 0 && (
                <span className="font-medium text-green-600 dark:text-green-400">
                  No issues
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lint Level Selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Lint Level
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(levelsQuery.data?.levels ?? []).map((lvl) => (
                <button
                  key={lvl.level}
                  onClick={() => canManage && handleLevelChange(lvl.level)}
                  disabled={!canManage}
                  aria-pressed={lintLevel === lvl.level}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    lintLevel === lvl.level
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-900/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
                    !canManage && "cursor-not-allowed opacity-60"
                  )}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Level {lvl.level} — {lvl.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lvl.description} ({lvl.rule_ids.length} rules)
                  </p>
                </button>
              ))}
              <button
                onClick={() => canManage && handleLevelChange(0)}
                disabled={!canManage}
                aria-pressed={lintLevel === 0}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  lintLevel === 0
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-900/20"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
                  !canManage && "cursor-not-allowed opacity-60"
                )}
              >
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Custom
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose rules individually
                </p>
              </button>
            </div>
          </div>

          {/* Rule List */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Rules ({enabledRules.size} of {rules.length} enabled)
              </label>
              {isCustom && canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEnabledRules(new Set(rules.map((r) => r.rule_id)))}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Enable all
                  </button>
                  <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={() => setEnabledRules(new Set())}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Disable all
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-600">
              {rules.map((rule) => {
                const enabled = enabledRules.has(rule.rule_id);
                return (
                  <div
                    key={rule.rule_id}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                      enabled
                        ? "bg-slate-50 dark:bg-slate-700/50"
                        : "bg-transparent opacity-60"
                    )}
                  >
                    {/* Toggle */}
                    <button
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleRuleToggle(rule.rule_id)}
                      disabled={!canManage || !isCustom}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        enabled
                          ? "bg-primary-600 dark:bg-primary-500"
                          : "bg-slate-300 dark:bg-slate-600",
                        (!canManage || !isCustom) && "cursor-not-allowed opacity-60"
                      )}
                      aria-label={`Toggle ${rule.name}`}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          enabled && "translate-x-4"
                        )}
                      />
                    </button>
                    {/* Rule info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {rule.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none",
                            getSeverityColor(rule.severity)
                          )}
                        >
                          {rule.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No lint rules available.
                </p>
              )}
            </div>
          </div>

          {/* Error/success messages — visible to all users */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Action buttons */}
          {canManage && (
            <div className="flex items-center justify-end gap-3">
              {success && (
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              )}
              <Button
                onClick={handleClearResults}
                disabled={isClearing}
                size="sm"
                variant="outline"
              >
                {isClearing ? "Clearing..." : "Clear Results"}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                size="sm"
              >
                {isSaving ? "Saving..." : "Save Lint Configuration"}
              </Button>
            </div>
          )}

          {!canManage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only project owners and admins can modify lint configuration.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

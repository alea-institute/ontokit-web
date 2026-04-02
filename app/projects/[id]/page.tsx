"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  Users,
  Globe,
  Lock,
  ExternalLink,
  Pencil,
  UserPlus,
  Clock,
  XCircle,
  X,
  Inbox,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { projectApi, type Project } from "@/lib/api/projects";
import {
  joinRequestApi,
  type MyJoinRequestResponse,
  type JoinRequestListResponse,
} from "@/lib/api/joinRequests";
import { cn, formatDate } from "@/lib/utils";

export default function ProjectPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join request state
  const [joinRequestStatus, setJoinRequestStatus] =
    useState<MyJoinRequestResponse | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingJoinCount, setPendingJoinCount] = useState(0);

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await projectApi.get(projectId, session?.accessToken);
        setProject(data);

        // Fetch pending join request count for admins/owners of public projects
        const userCanManage =
          data.user_role === "owner" ||
          data.user_role === "admin" ||
          data.is_superadmin;
        if (session?.accessToken && data.is_public && userCanManage) {
          try {
            const jrList: JoinRequestListResponse = await joinRequestApi.list(
              projectId,
              session.accessToken
            );
            setPendingJoinCount(jrList.total);
          } catch {
            // Ignore — join request listing may fail
          }
        }

        // Fetch join request status for authenticated users on public projects
        // who don't have a role
        if (
          session?.accessToken &&
          data.is_public &&
          !data.user_role
        ) {
          try {
            const jrStatus = await joinRequestApi.getMine(
              projectId,
              session.accessToken
            );
            setJoinRequestStatus(jrStatus);
          } catch {
            // Ignore — user may not have a join request
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("403")) {
          setError("You don't have access to this project");
        } else if (err instanceof Error && err.message.includes("404")) {
          setError("Project not found");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && projectId) {
      fetchProject();
    }
  }, [projectId, session?.accessToken, status]);

  const hasExplicitRole = !!project?.user_role;
  const canEdit =
    project?.user_role === "owner" ||
    project?.user_role === "admin" ||
    project?.user_role === "editor" ||
    project?.is_superadmin;
  const isSuggester = project?.user_role === "suggester" || (!hasExplicitRole && !!session?.accessToken);
  const canSuggest = canEdit || isSuggester;

  const canManage = project?.user_role === "owner" || project?.user_role === "admin" || project?.is_superadmin;

  const showJoinRequestSection =
    isAuthenticated &&
    project?.is_public &&
    !project?.user_role &&
    !project?.is_superadmin;

  const handleSubmitJoinRequest = async () => {
    if (!session?.accessToken || !project) return;

    setIsSubmittingJoin(true);
    setJoinError(null);

    try {
      await joinRequestApi.create(
        project.id,
        { message: joinMessage },
        session.accessToken
      );
      const jrStatus = await joinRequestApi.getMine(
        project.id,
        session.accessToken
      );
      setJoinRequestStatus(jrStatus);
      setShowJoinForm(false);
      setJoinMessage("");
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Failed to submit join request"
      );
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleWithdrawJoinRequest = async () => {
    if (
      !session?.accessToken ||
      !project ||
      !joinRequestStatus?.request
    )
      return;

    try {
      await joinRequestApi.withdraw(
        project.id,
        joinRequestStatus.request.id,
        session.accessToken
      );
      setJoinRequestStatus({
        has_pending_request: false,
        request: undefined,
      });
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Failed to withdraw request"
      );
    }
  };

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>

            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error || "Project not found"}
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

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          {/* Project Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {project.name}
                  </h1>
                  <div
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium",
                      project.is_public
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    {project.is_public ? (
                      <>
                        <Globe className="h-3.5 w-3.5" />
                        Public
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        Private
                      </>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="mt-2 text-slate-600 dark:text-slate-400">
                    {project.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>
                      {project.member_count}{" "}
                      {project.member_count === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <span>Created {formatDate(project.created_at)}</span>
                  {project.updated_at && (
                    <span>Updated {formatDate(project.updated_at)}</span>
                  )}
                </div>

                {project.user_role && (
                  <div className="mt-4">
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
                      {project.user_role.charAt(0).toUpperCase() +
                        project.user_role.slice(1)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {canManage && (
                  <Link href={`/projects/${project.id}/settings`}>
                    <Button variant="outline" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </Link>
                )}
                {canSuggest && (
                  <Link href={`/projects/${project.id}/editor`}>
                    <Button size="sm">
                      <Pencil className="mr-2 h-4 w-4" />
                      Open Editor
                    </Button>
                  </Link>
                )}
                {!canSuggest && !showJoinRequestSection && (
                  <Link href={`/projects/${project.id}/editor`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </Link>
                )}
                {showJoinRequestSection && (
                  <>
                    {joinRequestStatus?.has_pending_request ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Request Pending
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleWithdrawJoinRequest}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Withdraw
                        </Button>
                      </div>
                    ) : joinRequestStatus?.request?.status === "declined" ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          Request Declined
                        </span>
                        <Button
                          size="sm"
                          onClick={() => setShowJoinForm(true)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Request Again
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setShowJoinForm(true)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Request to Join
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Pending Join Requests Banner (admin/owner only) */}
          {canManage && project.is_public && pendingJoinCount > 0 && (
            <Link
              href={`/projects/${project.id}/settings#join-requests`}
              className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
            >
              <Inbox className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {pendingJoinCount} pending join{" "}
                  {pendingJoinCount === 1 ? "request" : "requests"}
                </p>
              </div>
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Review in Settings
              </span>
            </Link>
          )}

          {/* Join Request Form */}
          {showJoinForm && (
            <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-5 dark:border-primary-800 dark:bg-primary-900/20">
              <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">
                Request to Join
              </h3>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Tell the project owners why you&apos;d like to join this project.
              </p>
              {joinError && (
                <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {joinError}
                </div>
              )}
              <textarea
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="I'd like to contribute to this project because..."
                rows={3}
                minLength={10}
                maxLength={1000}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm",
                  "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                )}
                disabled={isSubmittingJoin}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {joinMessage.length}/1000 characters (minimum 10)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowJoinForm(false);
                      setJoinMessage("");
                      setJoinError(null);
                    }}
                    disabled={isSubmittingJoin}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitJoinRequest}
                    disabled={isSubmittingJoin || joinMessage.length < 10}
                  >
                    {isSubmittingJoin ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={`/projects/${project.id}/editor`}
              className="rounded-lg border border-slate-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-600"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                <Pencil className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                Ontology Editor
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {canEdit ? "Edit classes, properties, and individuals" : canSuggest ? "Suggest changes to classes, properties, and individuals" : "View the ontology structure"}
              </p>
            </Link>

            {canManage && (
              <Link
                href={`/projects/${project.id}/settings`}
                className="rounded-lg border border-slate-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-600"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  <Settings className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  Project Settings
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Manage members, visibility, and project details
                </p>
              </Link>
            )}

            {(canManage || project.member_count > 1) && (
              <Link
                href={`/projects/${project.id}/settings#members`}
                className="rounded-lg border border-slate-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-600"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  Team Members
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {project.member_count} {project.member_count === 1 ? "member" : "members"} in this project
                </p>
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

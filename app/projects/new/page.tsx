"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Upload, Github } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { ProjectForm } from "@/components/projects/project-form";
import { GitHubRepoPicker } from "@/components/projects/github-repo-picker";
import { OntologyFilePicker } from "@/components/projects/ontology-file-picker";
import {
  projectApi,
  type ProjectCreate,
  type ProjectImportData,
  type GitHubRepoFileInfo,
  type ProjectCreateFromGitHub,
} from "@/lib/api/projects";
import type { GitHubRepoInfo } from "@/lib/api/userSettings";
import type { UploadProgress } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type TabType = "create" | "import" | "github";

const GITHUB_CLONE_STEPS = [
  { label: "Parsing ontology file...", progress: 15 },
  { label: "Normalizing to Turtle format...", progress: 30 },
  { label: "Creating project...", progress: 45 },
  { label: "Cloning repository...", progress: 70 },
  { label: "Normalizing repository content...", progress: 85 },
  { label: "Finalizing...", progress: 95 },
];

export default function NewProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // GitHub clone state
  const [githubRepo, setGithubRepo] = useState<GitHubRepoInfo | null>(null);
  const [githubFile, setGithubFile] = useState<GitHubRepoFileInfo | null>(null);
  const [githubTurtlePath, setGithubTurtlePath] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubCloneStep, setGithubCloneStep] = useState(0);

  // Advance GitHub clone progress steps on a timer
  useEffect(() => {
    if (!(isSubmitting && activeTab === "github")) {
      setGithubCloneStep(0);
      return;
    }

    const delays = [0, 1500, 3500, 5500, 20500, 25500];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setGithubCloneStep(i), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isSubmitting, activeTab]);

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const handleCreateSubmit = async (data: {
    name: string;
    description?: string;
    is_public: boolean;
  }) => {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to create a project");
    }

    setIsSubmitting(true);
    try {
      const project = await projectApi.create(data as ProjectCreate, session.accessToken);
      router.push(`/projects/${project.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportSubmit = async (data: {
    name: string;
    description?: string;
    is_public: boolean;
  }) => {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to import a project");
    }

    if (!selectedFile) {
      throw new Error("Please select a file to import");
    }

    setIsSubmitting(true);
    setImportError(null);
    setUploadProgress(null);

    try {
      const importData: ProjectImportData = {
        file: selectedFile,
        is_public: data.is_public,
        name: data.name || undefined,
        description: data.description || undefined,
      };

      const project = await projectApi.import(
        importData,
        session.accessToken,
        (progress) => setUploadProgress(progress)
      );
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof Error) {
        try {
          const errorData = JSON.parse(err.message);
          setImportError(errorData.detail || err.message);
        } catch {
          setImportError(err.message);
        }
      } else {
        setImportError("An error occurred while importing the file");
      }
      throw err;
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleGitHubSubmit = async (data: {
    name: string;
    description?: string;
    is_public: boolean;
  }) => {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to create a project");
    }

    if (!githubRepo || !githubFile) {
      throw new Error("Please select a repository and ontology file");
    }

    setIsSubmitting(true);
    setGithubError(null);

    try {
      const createData: ProjectCreateFromGitHub = {
        repo_owner: githubRepo.owner,
        repo_name: githubRepo.name,
        ontology_file_path: githubFile.path,
        turtle_file_path: githubTurtlePath || undefined,
        is_public: data.is_public,
        name: data.name || undefined,
        description: data.description || undefined,
        default_branch: githubRepo.default_branch,
      };

      const project = await projectApi.createFromGitHub(createData, session.accessToken);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof Error) {
        try {
          const errorData = JSON.parse(err.message);
          setGithubError(errorData.detail || err.message);
        } catch {
          setGithubError(err.message);
        }
      } else {
        setGithubError("An error occurred while cloning the repository");
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/projects");
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          </div>
        </main>
      </>
    );
  }

  // Redirect to sign in if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Sign in required
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                You need to be signed in to create a project.
              </p>
              <Link href="/auth/signin" className="mt-4 inline-block">
                <Button>Sign In</Button>
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
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create a new project
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Projects help you organize ontologies and collaborate with others.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "create"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <Plus className="h-4 w-4" />
              Create Empty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "import"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <Upload className="h-4 w-4" />
              Import from File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("github")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "github"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <Github className="h-4 w-4" />
              Clone from GitHub
            </button>
          </div>

          {/* Tab Content */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            {activeTab === "create" && (
              <ProjectForm
                onSubmit={handleCreateSubmit}
                onCancel={handleCancel}
                submitLabel="Create Project"
                isLoading={isSubmitting}
              />
            )}

            {activeTab === "import" && (
              <div className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Ontology File <span className="text-red-500">*</span>
                  </label>
                  <FileUpload
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    disabled={isSubmitting}
                    error={importError}
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    The project name and description will be extracted from the ontology metadata.
                    You can override them below.
                  </p>
                </div>

                {/* Upload Progress */}
                {uploadProgress && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {uploadProgress.phase === "uploading"
                          ? "Uploading file..."
                          : "Processing ontology..."}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {uploadProgress.phase === "uploading"
                          ? `${uploadProgress.percentage}%`
                          : "Please wait"}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                      {uploadProgress.phase === "uploading" ? (
                        <div
                          className="h-full rounded-full bg-primary-600 transition-all duration-300"
                          style={{ width: `${uploadProgress.percentage}%` }}
                        />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-primary-400" />
                      )}
                    </div>
                    {uploadProgress.phase === "processing" && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Parsing ontology and initializing project...
                      </p>
                    )}
                  </div>
                )}

                {/* Project Form (for overrides and visibility) */}
                <ProjectForm
                  onSubmit={handleImportSubmit}
                  onCancel={handleCancel}
                  submitLabel="Import Project"
                  isLoading={isSubmitting}
                  nameRequired={false}
                  namePlaceholder="Leave empty to use name from ontology"
                  descriptionPlaceholder="Leave empty to use description from ontology"
                />
              </div>
            )}

            {activeTab === "github" && (
              <div className="space-y-6">
                {/* Step 1: Select Repository */}
                <div>
                  <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
                    Step 1: Select a repository
                  </h3>
                  <GitHubRepoPicker
                    onSelect={(repo) => {
                      setGithubRepo(repo);
                      setGithubFile(null);
                      setGithubTurtlePath(null);
                      setGithubError(null);
                    }}
                  />
                </div>

                {/* Step 2: Select Ontology File */}
                {githubRepo && session?.accessToken && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
                      Step 2: Select an ontology file
                    </h3>
                    <OntologyFilePicker
                      owner={githubRepo.owner}
                      repo={githubRepo.name}
                      token={session.accessToken}
                      onSelect={(file, turtlePath) => {
                        setGithubFile(file);
                        setGithubTurtlePath(turtlePath);
                        setGithubError(null);
                      }}
                    />
                  </div>
                )}

                {/* Step 3: Project Form */}
                {githubRepo && githubFile && githubTurtlePath && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
                      Step 3: Configure project
                    </h3>

                    {/* Selected summary */}
                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Repository: <span className="font-medium text-slate-700 dark:text-slate-300">{githubRepo.full_name}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Source file: <span className="font-medium text-slate-700 dark:text-slate-300">{githubFile.path}</span>
                      </p>
                      {githubTurtlePath && githubTurtlePath !== githubFile.path && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Turtle output: <span className="font-medium text-slate-700 dark:text-slate-300">{githubTurtlePath}</span>
                        </p>
                      )}
                    </div>

                    {/* Error */}
                    {githubError && (
                      <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {githubError}
                      </div>
                    )}

                    {/* Clone Progress */}
                    {isSubmitting && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {GITHUB_CLONE_STEPS[githubCloneStep].label}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {GITHUB_CLONE_STEPS[githubCloneStep].progress}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                          <div
                            className="h-full rounded-full bg-primary-600 transition-all duration-1000 ease-out"
                            style={{ width: `${GITHUB_CLONE_STEPS[githubCloneStep].progress}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          This may take a moment for large repositories
                        </p>
                      </div>
                    )}

                    <ProjectForm
                      onSubmit={handleGitHubSubmit}
                      onCancel={handleCancel}
                      submitLabel={isSubmitting ? "Cloning repository..." : "Clone & Create Project"}
                      isLoading={isSubmitting}
                      nameRequired={false}
                      namePlaceholder="Leave empty to use name from ontology"
                      descriptionPlaceholder="Leave empty to use description from ontology"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

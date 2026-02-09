"use client";

import { useState } from "react";
import { Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProjectFormData {
  name: string;
  description?: string;
  is_public: boolean;
}

interface ProjectFormProps {
  initialData?: {
    name: string;
    description?: string;
    is_public: boolean;
  };
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  nameRequired?: boolean;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
}

export function ProjectForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Create Project",
  isLoading = false,
  nameRequired = true,
  namePlaceholder = "My Ontology Project",
  descriptionPlaceholder = "A brief description of your project...",
}: ProjectFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [isPublic, setIsPublic] = useState(initialData?.is_public ?? false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nameRequired && !name.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Project Name {nameRequired && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(
            "mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm",
            "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
            "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          )}
          placeholder={namePlaceholder}
          maxLength={255}
          required={nameRequired}
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={cn(
            "mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm",
            "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
            "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          )}
          placeholder={descriptionPlaceholder}
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Visibility
        </label>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            disabled={isLoading}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-all",
              !isPublic
                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-900/20"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                !isPublic
                  ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800"
              )}
            >
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Private</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Only members can access
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsPublic(true)}
            disabled={isLoading}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-all",
              isPublic
                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-900/20"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                isPublic
                  ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800"
              )}
            >
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Public</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Anyone can view this project
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || (nameRequired && !name.trim())}>
          {isLoading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

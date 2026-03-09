"use client";

import { useCallback, useState } from "react";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const SUPPORTED_EXTENSIONS = [".owl", ".rdf", ".ttl", ".n3", ".jsonld"];
const _SUPPORTED_MIME_TYPES = [
  "application/rdf+xml",
  "application/owl+xml",
  "text/turtle",
  "text/n3",
  "application/ld+json",
  "application/json",
  "text/xml",
  "application/xml",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  disabled?: boolean;
  error?: string | null;
}

export function FileUpload({
  onFileSelect,
  selectedFile,
  disabled = false,
  error,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file extension
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return `Unsupported file format. Supported formats: ${SUPPORTED_EXTENSIONS.join(", ")}`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        onFileSelect(null);
      } else {
        setValidationError(null);
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleRemoveFile = useCallback(() => {
    setValidationError(null);
    onFileSelect(null);
  }, [onFileSelect]);

  const displayError = error || validationError;

  return (
    <div className="space-y-2">
      {selectedFile ? (
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-4",
            displayError
              ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
              : "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                displayError
                  ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
                  : "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
              )}
            >
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {selectedFile.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            disabled={disabled}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            isDragging
              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
              : "border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <input
            type="file"
            className="hidden"
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={handleInputChange}
            disabled={disabled}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Upload className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDragging ? "Drop your file here" : "Click to upload or drag and drop"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            OWL, RDF, Turtle, N3, or JSON-LD (max 50 MB)
          </p>
        </label>
      )}

      {displayError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {displayError}
        </div>
      )}
    </div>
  );
}

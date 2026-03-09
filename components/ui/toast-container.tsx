"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { useToast, type Toast } from "@/lib/context/ToastContext";
import { cn } from "@/lib/utils";

const toastIcons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const toastStyles = {
  success: "border-emerald-200 dark:border-emerald-800",
  error: "border-red-200 dark:border-red-800",
  warning: "border-amber-200 dark:border-amber-800",
  info: "border-blue-200 dark:border-blue-800",
};

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => removeToast(toast.id), 150);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg transition-all duration-150 dark:bg-slate-800",
        toastStyles[toast.type],
        isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      )}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{toastIcons[toast.type]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {toast.description}
          </p>
        )}
      </div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick();
            handleDismiss();
          }}
          className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

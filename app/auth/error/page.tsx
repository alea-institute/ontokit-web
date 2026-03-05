"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  const isTransient = error === "Configuration" || error === "OAuthSignin" || error === "OAuthCallback" || error === "Callback";
  const RETRY_SECONDS = 10;
  const MAX_RETRIES = 6;

  const [countdown, setCountdown] = useState(isTransient ? RETRY_SECONDS : 0);
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(() => {
    setRetrying(true);
    router.push("/auth/signin");
  }, [router]);

  // Auto-retry countdown for transient errors
  useEffect(() => {
    if (!isTransient || retryCount >= MAX_RETRIES || retrying) return;
    if (countdown <= 0) {
      setRetryCount((c) => c + 1);
      retry();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, isTransient, retryCount, retrying, retry]);

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: "Service Temporarily Unavailable",
      description: "The authentication service is starting up or restarting. This usually resolves within a minute.",
    },
    AccessDenied: {
      title: "Access Denied",
      description: "You do not have permission to access this resource.",
    },
    Verification: {
      title: "Verification Error",
      description: "The verification token has expired or has already been used.",
    },
    OAuthSignin: {
      title: "Sign In Unavailable",
      description: "The authentication service could not be reached. It may be restarting.",
    },
    OAuthCallback: {
      title: "Authentication Interrupted",
      description: "The authentication callback failed. The service may be temporarily unavailable.",
    },
    OAuthCreateAccount: {
      title: "Account Creation Error",
      description: "There was a problem creating your account.",
    },
    Callback: {
      title: "Authentication Interrupted",
      description: "The authentication callback failed. The service may be temporarily unavailable.",
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication.",
    },
  };

  const errorInfo = errorMessages[error || "Default"] || errorMessages.Default;
  const exhaustedRetries = retryCount >= MAX_RETRIES;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${isTransient && !exhaustedRetries ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
            {isTransient && !exhaustedRetries ? (
              <svg className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            {errorInfo.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {errorInfo.description}
          </p>
          {isTransient && !exhaustedRetries && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400 font-medium">
              Retrying in {countdown}s{retryCount > 0 ? ` (attempt ${retryCount + 1}/${MAX_RETRIES})` : ""}...
            </p>
          )}
          {exhaustedRetries && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              The service appears to be down. Please check that the backend is running.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => {
              setRetryCount(0);
              setCountdown(RETRY_SECONDS);
              setRetrying(false);
              retry();
            }}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            {retrying ? "Retrying..." : "Try signing in again"}
          </button>
          <Link
            href="/"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}

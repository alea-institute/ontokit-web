"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-bold text-gray-900 dark:text-white">
            OntoKit
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Collaborative ontology curation platform
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error === "OAuthSignin" && "Error starting OAuth sign in."}
              {error === "OAuthCallback" && "Error during OAuth callback."}
              {error === "OAuthCreateAccount" && "Error creating OAuth account."}
              {error === "Callback" && "Error during callback."}
              {error === "AccessDenied" && "Access denied."}
              {error === "Configuration" && "Server configuration error. Please check Zitadel settings."}
              {!["OAuthSignin", "OAuthCallback", "OAuthCreateAccount", "Callback", "AccessDenied", "Configuration"].includes(error) && "An error occurred during sign in."}
            </p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => signIn("zitadel", { callbackUrl })}
            className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            Sign in with Zitadel
          </button>
        </div>

        <div className="mt-6">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}

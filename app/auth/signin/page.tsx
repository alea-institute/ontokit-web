"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-bold text-gray-900 dark:text-white">
            OntoKit
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
            FOLIO Ontology Browser
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Browse the Federated Open Legal Information Ontology
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => router.push("/projects")}
            className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Browse FOLIO Ontology
          </button>
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

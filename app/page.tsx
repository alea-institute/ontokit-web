import Link from "next/link";
import { Header } from "@/components/layout/header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-24">
        <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          OntoKit
        </h1>
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">
          Collaborative OWL Ontology Curation Platform
        </p>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Build knowledge graphs together with real-time editing and Git integration
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/projects"
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="https://github.com/ontokit"
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-3xl mb-3">🦉</div>
            <h3 className="font-semibold text-slate-900 dark:text-white">OWL 2 Support</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Full support for OWL 2 ontologies with multiple serialization formats
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Real-time Collaboration</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Edit ontologies together with live cursors and presence indicators
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-3xl mb-3">🔗</div>
            <h3 className="font-semibold text-slate-900 dark:text-white">GitHub Integration</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Version control with Git and seamless GitHub synchronization
            </p>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

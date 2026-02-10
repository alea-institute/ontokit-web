export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
        Documentation
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Documentation for Axigraph is coming soon.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Getting Started
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Axigraph is an ontology editor and collaboration platform for working with RDF/OWL ontologies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Features
          </h2>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
            <li>Visual tree-based ontology editing</li>
            <li>Source code view with Turtle syntax highlighting</li>
            <li>Real-time validation and linting</li>
            <li>Git-based version control integration</li>
            <li>Pull request workflow for collaboration</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

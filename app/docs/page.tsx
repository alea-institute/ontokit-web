import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Documentation
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Learn how to use OntoKit to create, edit, and collaborate on OWL ontologies.
          </p>

          <div className="space-y-10">
            {/* Getting Started */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Getting Started
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  OntoKit is a modern, collaborative OWL ontology curation platform designed as a
                  replacement for Stanford WebProtege. It provides a streamlined workflow for creating,
                  editing, and managing semantic web ontologies.
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Quick Start</h3>
                  <ol className="list-decimal list-inside text-slate-600 dark:text-slate-400 space-y-2">
                    <li>Sign in with your account</li>
                    <li>Create a new project or join an existing one</li>
                    <li>Upload an ontology file (Turtle, RDF/XML, OWL/XML) or start from scratch</li>
                    <li>Use the visual editor to browse and modify classes, properties, and individuals</li>
                    <li>Create branches and pull requests for collaborative changes</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Core Concepts */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Core Concepts
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Projects</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Projects are containers for your ontologies. Each project has its own Git repository
                    for version control, team members, and access settings.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Branches</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Work on changes in isolated branches without affecting the main ontology.
                    Merge changes through pull requests when ready.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Pull Requests</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Propose changes to the ontology through pull requests. Review semantic diffs,
                    discuss changes, and merge when approved.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Linting</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Automatic validation checks your ontology for common issues, missing labels,
                    and best practice violations.
                  </p>
                </div>
              </div>
            </section>

            {/* Team Roles & Permissions */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Team Roles & Permissions
              </h2>
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">
                  Each project member is assigned a role that determines what they can do.
                  Roles are project-scoped &mdash; a user can have different roles in different projects.
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Role</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Capabilities</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Owner</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Full control over the project. Can delete the project, transfer ownership,
                          manage members and settings, create branches, edit the ontology, and run the health check.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Admin</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Manage members and project settings, create branches, edit the ontology,
                          and run the health check. Cannot delete the project.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Editor</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Create branches, edit ontology source, and create pull requests.
                          Cannot manage members, change settings, or run the health check.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Viewer</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Browse the class tree, view the source in read-only mode, and view
                          health check results. Cannot make any changes.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Good to know
                  </h4>
                  <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 text-sm space-y-1">
                    <li>The person who creates a project automatically becomes its Owner</li>
                    <li>Public projects can be viewed by anyone, but only members can edit</li>
                    <li>Private projects are only visible to their members</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Editor Features */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Editor Features
              </h2>
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Class Tree</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    Navigate your ontology using the hierarchical class tree. Classes are organized
                    by their subclass relationships, with lazy loading for large ontologies.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Expand/collapse class hierarchies</li>
                    <li>View subclass counts at each level</li>
                    <li>Search for classes by name or IRI</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Source Editor</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    Edit your ontology directly in Turtle syntax with full syntax highlighting,
                    auto-completion, and inline validation.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Turtle syntax highlighting</li>
                    <li>Hover over IRIs to see full definitions</li>
                    <li>Ctrl+Click to navigate to class definitions</li>
                    <li>Real-time linting with inline error markers</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Detail Panel</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    View and edit class metadata including labels, comments, annotations,
                    and relationships.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Multi-language label support</li>
                    <li>Superclass and subclass relationships</li>
                    <li>Annotation properties</li>
                    <li>Usage statistics</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Supported Formats */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Supported Formats
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Format</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Extension</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">MIME Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    <tr>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Turtle</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">.ttl</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">text/turtle</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">RDF/XML</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">.rdf, .xml</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">application/rdf+xml</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">OWL/XML</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">.owl</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">application/owl+xml</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">N-Triples</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">.nt</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">application/n-triples</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">JSON-LD</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">.jsonld</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">application/ld+json</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Import & Normalization */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Import & Normalization
              </h2>
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">
                    Canonical Turtle Format
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    When you import an ontology file, OntoKit normalizes it to a canonical Turtle format.
                    This ensures consistent formatting across all edits and produces minimal, meaningful
                    diffs in version history. The normalization happens once at import time.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                      What changes during normalization:
                    </h4>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-sm space-y-1">
                      <li>All formats (RDF/XML, OWL/XML, N3, JSON-LD) are converted to Turtle (.ttl)</li>
                      <li>Triples are reordered into a consistent, deterministic sequence</li>
                      <li>Unused namespace prefixes may be removed (e.g., <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">rdf:</code>, <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">xml:</code>, <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">xsd:</code> if not explicitly used)</li>
                      <li>Whitespace and formatting are standardized</li>
                      <li>The shorthand <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">a</code> is used for <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">rdf:type</code></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">
                    Metadata Synchronization
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    When you update a project&apos;s name or description in Project Settings, OntoKit
                    automatically syncs these changes to the ontology&apos;s RDF metadata properties.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2 text-sm">
                      How metadata sync works:
                    </h4>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                      <li>
                        <strong>Title:</strong> Updates <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dc:title</code>, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dcterms:title</code>, or <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:label</code> (whichever exists)
                      </li>
                      <li>
                        <strong>Description:</strong> Updates <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dc:description</code>, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dcterms:description</code>, or <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:comment</code>
                      </li>
                      <li>If no metadata property exists, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dc:title</code> / <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dc:description</code> is added</li>
                      <li>Changes are committed to git with a descriptive message</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* API Reference Link */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                API Reference
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  OntoKit provides a comprehensive REST API for programmatic access to all platform features.
                  Use the API to integrate OntoKit with your existing tools and workflows.
                </p>
                <Link
                  href="/api-docs"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View API Documentation
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </section>
          </div>
        </div>
  );
}

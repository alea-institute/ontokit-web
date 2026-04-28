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
                  OntoKit is a modern, collaborative OWL ontology curation platform designed as a{" "}
                  replacement for Stanford WebProtege. It provides a streamlined workflow for creating,{" "}
                  editing, and managing semantic web ontologies.
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Quick Start</h3>
                  <ol className="list-decimal list-inside text-slate-600 dark:text-slate-400 space-y-2">
                    <li>Browse public projects without signing in, or sign in to create and contribute</li>
                    <li>Create a new project or join an existing one</li>
                    <li>Upload an ontology file (Turtle, RDF/XML, OWL/XML) or start from scratch</li>
                    <li>Use the form-based editor to browse and modify classes, properties, and individuals</li>
                    <li>Changes are auto-saved as drafts; navigate away to commit them to git</li>
                    <li>Create branches and pull requests, or submit suggestions for review</li>
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
                    Projects are containers for your ontologies. Each project has its own Git repository{" "}
                    for version control, team members, and access settings.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Branches</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Work on changes in isolated branches without affecting the main ontology.{" "}
                    Merge changes through pull requests when ready.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Pull Requests</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Propose changes to the ontology through pull requests. Review semantic diffs,{" "}
                    discuss changes, and merge when approved.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Suggestions</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Suggesters can propose changes without direct edit access. Suggestions are{" "}
                    auto-saved as you work and submitted for editor review with approve, reject, or{" "}
                    request-changes outcomes.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Linting</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Automatic validation checks your ontology for common issues, missing labels,{" "}
                    and best practice violations.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Auto-Save</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    A two-tier auto-save system protects your work: edits are cached locally on blur,{" "}
                    and committed to git when you navigate away. Draft indicators show unsaved changes{" "}
                    on tree nodes.
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
                  Each project member is assigned a role that determines what they can do.{" "}
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
                          Full control over the project. Can delete the project, transfer ownership,{" "}
                          manage members and settings, create branches, edit the ontology, and run the health check.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Admin</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Manage members and project settings, create branches, edit the ontology,{" "}
                          and run the health check. Cannot delete the project.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Editor</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Create branches, edit ontology source, and create pull requests.{" "}
                          Review and approve/reject suggestions from suggesters.{" "}
                          Cannot manage members, change settings, or run the health check.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Suggester</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Propose changes via suggestion sessions that are reviewed by editors.{" "}
                          Can browse the ontology, create and submit suggestions, and view their{" "}
                          own suggestion history. Cannot directly edit the ontology or create branches.{" "}
                          This is the default role for new project members.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium align-top">Viewer</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          Browse the class tree, view the source in read-only mode, and view{" "}
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
                    <li>New project members are assigned the Suggester role by default</li>
                    <li>Public projects can be viewed by anyone, but only members can edit</li>
                    <li>Private projects are only visible to their members</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Editor Modes */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Editor Modes
              </h2>
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">
                  OntoKit offers two editing modes to suit different workflows. Your preference{" "}
                  is saved and persists across sessions.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Standard Mode</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      A form-based editing experience for classes, properties, and individuals.{" "}
                      Edit labels, comments, annotations, and relationships through structured{" "}
                      fields. Entities are read-only by default &mdash; click &quot;Edit Item&quot; to{" "}
                      start editing, with changes auto-saved as you work.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Developer Mode</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      Direct access to the Turtle source with full syntax highlighting,{" "}
                      auto-completion, and inline validation in a Monaco-based editor. Ideal for{" "}
                      power users who prefer working with raw RDF/OWL syntax.
                    </p>
                  </div>
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
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Entity Tree</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    Navigate your ontology using hierarchical trees for classes, properties, and{" "}
                    individuals. Entities are organized by their subclass/subproperty relationships,{" "}
                    with lazy loading for large ontologies.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Expand/collapse hierarchies with multi-level controls (one level, all, or none)</li>
                    <li>View subclass counts at each level</li>
                    <li>Search for entities by name or IRI</li>
                    <li>Drag-and-drop reparenting with cycle detection and undo</li>
                    <li>Right-click context menus for Add Subclass, Copy IRI, View in Source, and Delete</li>
                    <li>Draft indicators on nodes with unsaved changes</li>
                    <li>Language tags displayed as country flag emojis</li>
                    <li>Keyboard navigation with arrow keys and aria-activedescendant</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Detail Panel</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    View and edit entity metadata through structured forms. Separate panels are{" "}
                    provided for classes, properties, and individuals, each tailored to their{" "}
                    specific OWL constructs.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Multi-language label and comment editing with inline annotation adder</li>
                    <li>Superclass/subclass and equivalent/disjoint relationships</li>
                    <li>Annotation properties with IRI-valued relationship editing</li>
                    <li>Property assertions for individuals</li>
                    <li>Entity history tab with revision tracking</li>
                    <li>Similar concepts panel for discovering related entities</li>
                    <li>Cross-references panel showing where an entity is used</li>
                    <li>Delete impact analysis before entity removal</li>
                    <li>Resizable panel dividers for customizing the layout</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Graph Visualization</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    Explore ontology relationships visually with an interactive graph view powered{" "}
                    by React Flow and ELK layout.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Depth-2 neighbor fetching with expandable nodes</li>
                    <li>Custom node styling for focus, parent, child, equivalent, and disjoint classes</li>
                    <li>Color-coded edges for different relationship types with hover labels</li>
                    <li>Root nodes highlighted with distinct amber/gold styling</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">Source Editor</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    Edit your ontology directly in Turtle syntax with full syntax highlighting,{" "}
                    auto-completion, and inline validation. Available in Developer mode or via{" "}
                    the Source tab.
                  </p>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                    <li>Turtle syntax highlighting</li>
                    <li>Hover over IRIs to see full definitions</li>
                    <li>Ctrl+Click to navigate to class definitions or open external IRIs in a new tab</li>
                    <li>Real-time linting with inline error markers</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Keyboard Shortcuts */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Keyboard Shortcuts
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Shortcut</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    <tr>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-mono text-xs">Ctrl+S / Cmd+S</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Save current drafts</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-mono text-xs">Ctrl+N / Cmd+N</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Create a new entity</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-mono text-xs">?</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Show keyboard shortcuts help</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-mono text-xs">Escape</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Close overlays and dialogs</td>
                    </tr>
                  </tbody>
                </table>
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
                    When you import an ontology file, OntoKit normalizes it to a canonical Turtle format.{" "}
                    This ensures consistent formatting across all edits and produces minimal, meaningful{" "}
                    diffs in version history. The normalization happens once at import time.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                      What changes during normalization:
                    </h4>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-sm space-y-1">
                      <li>All formats (RDF/XML, OWL/XML, N3, JSON-LD) are converted to Turtle (.ttl)</li>
                      <li>Triples are reordered into a consistent, deterministic sequence</li>
                      <li>Unused namespace prefixes may be removed (e.g., <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded-sm">rdf:</code>, <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded-sm">xml:</code>, <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded-sm">xsd:</code> if not explicitly used)</li>
                      <li>Whitespace and formatting are standardized</li>
                      <li>The shorthand <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded-sm">a</code> is used for <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded-sm">rdf:type</code></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">
                    Metadata Synchronization
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    When you update a project&apos;s name or description in Project Settings, OntoKit{" "}
                    automatically syncs these changes to the ontology&apos;s RDF metadata properties.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2 text-sm">
                      How metadata sync works:
                    </h4>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                      <li>
                        <strong>Title:</strong> Updates <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dc:title</code>, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dcterms:title</code>, or <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:label</code> (whichever exists)
                      </li>
                      <li>
                        <strong>Description:</strong> Updates <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dc:description</code>, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dcterms:description</code>, or <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:comment</code>
                      </li>
                      <li>If no metadata property exists, <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dc:title</code> / <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dc:description</code> is added</li>
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
                  OntoKit provides a comprehensive REST API for programmatic access to all platform features.{" "}
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

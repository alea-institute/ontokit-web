import { ChangelogToc } from "@/components/docs/ChangelogToc";
import { changelogAnchorId } from "@/lib/docs/changelog";

interface ChangelogCategory {
  title: string;
  items: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  categories: ChangelogCategory[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "0.3.0",
    date: "2026-04-09",
    categories: [
      {
        title: "New features",
        items: [
          "Projects list as landing page with Public, My Projects, Private, and All tabs.",
          "Separate viewer and editor routes for projects with role-appropriate default views.",
          "Ontology search index management UI for PostgreSQL-backed entity indexing.",
          "Multi-page Ontology Guide documentation accessible from the app.",
          "Upstream source loop prevention UI with informational banners when sync config matches GitHub integration.",
          "Exemplar ontology support in project UI for template-based project creation.",
          "Explicit Save button in detail panel edit mode.",
          "Branch topology visualization in revision history graph.",
          "Share button to copy project permalink.",
          "Unfiltered project count shown when search or filter is active.",
        ],
      },
      {
        title: "Improvements",
        items: [
          "Upgraded to Next.js 16, Tailwind CSS 4, Zod 4, and lucide-react 1.7.",
          "Renamed 'upstream sync' to 'remote sync' / 'Sync from Remote' for clarity.",
          "Renamed misleading 'Private' tab to 'My Projects'.",
          "Skip project dashboard — navigate directly to editor.",
          "Improved auth UX for private projects in the editor.",
          "Improved import error UX with server-reachability probe.",
          "Improved lint issue display consistency and prevented UI freeze on large rule sets.",
          "Replaced window.location.reload() with React Query refetch for smoother navigation.",
          "Removed accessToken from React Query keys to prevent unnecessary refetches.",
          "Disabled branch switching for unauthenticated users.",
          "Moved Tooltip provider to app level for shared usage.",
          "Docker deployment configuration with multi-stage build.",
          "Test coverage increased to 80% with 2400+ tests.",
        ],
      },
      {
        title: "Bug fixes",
        items: [
          "Fixed viewer source tab appearing empty in developer mode.",
          "Fixed total project count not shown with Load More pagination.",
          "Fixed duplicate BranchBadge in editor header.",
          "Fixed nullable index fields from API causing runtime errors.",
          "Fixed manualSave prop renamed to hideSaveButton with correct default behavior.",
          "Fixed exhaustive-deps false positive in useProjectViewer.",
          "Resolved Dependabot security alerts and CodeQL findings.",
        ],
      },
      {
        title: "CI/CD & Quality",
        items: [
          "Split CI quality gate into parallel lint, type-check, test, and build jobs.",
          "Added Codecov bundle analysis and test coverage reporting.",
          "Upgraded Vite to 8.0.7 for security fix.",
        ],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-03-09",
    categories: [
      {
        title: "New features",
        items: [
          "Form-based entity editing for classes, properties, and individuals replacing raw Turtle source editing.",
          "Standard/Developer mode toggle with persistent preference for simplified or advanced editing views.",
          "Suggestion workflow: new 'suggester' role allows non-editors to propose changes with mandatory editor review.",
          "Two-tier auto-save system: on blur saves drafts to localStorage, navigation commits to git.",
          "Interactive graph visualization using React Flow with ELK layout for exploring ontology relationships.",
          "Drag-and-drop class reparenting with cycle detection and undo support.",
          "Context menus (right-click) for Add Subclass, Copy IRI, View in Source, and Delete operations.",
          "Notification system with polling and event-driven refetch for suggestion and collaboration updates.",
          "Entity history tab with revision tracking.",
          "Similar concepts panel and cross-references panel for entity discovery.",
          "SPARQL query execution support (SELECT/ASK/CONSTRUCT) on the backend.",
          "Semantic search using vector similarity with pluggable embedding providers (OpenAI, Voyage, local).",
          "Duplicate detection with union-find clustering and similarity scoring.",
          "Consistency checking: cycle detection, class hierarchy validation, and deprecated entity tracking.",
          "Full dark mode support with theme sync preventing flash of unstyled content.",
          "Keyboard shortcuts: Ctrl+S to flush drafts, Ctrl+N to create entities, ? for help.",
        ],
      },
      {
        title: "Improvements",
        items: [
          "Shared FOLIO-style tree renderer reused across Classes, Properties, and Individuals.",
          "Multi-level expand/collapse controls with split-button for one level or all/none.",
          "Auto-expand on 800ms hover during drag operations.",
          "Language tags displayed as country flag emojis.",
          "Resizable panel dividers for tree/detail layout.",
          "Delete impact analysis before entity removal.",
          "API retry logic with 30s timeout and exponential backoff.",
          "Rate limiting via slowapi (100 req/min default).",
          "Security headers: X-Content-Type-Options, X-Frame-Options, HSTS, CSP.",
          "Request ID middleware with unique X-Request-ID header and access logging.",
          "Zod-based environment variable validation on the frontend.",
          "ESLint flat config migration with stricter TypeScript rules.",
        ],
      },
      {
        title: "Accessibility",
        items: [
          "Skip links in layout for keyboard navigation.",
          "Screen reader announcer with polite and assertive live regions.",
          "ARIA labels on all icon buttons.",
          "Reduced motion and high contrast media query support.",
          "Tree keyboard navigation with aria-activedescendant.",
        ],
      },
      {
        title: "Testing & Quality",
        items: [
          "111 new tests added across frontend (26) and backend (85).",
          "CI/CD pipeline with GitHub Actions: lint, type-check, test, and build stages.",
          "All 178 mypy strict-mode errors fixed on the backend.",
          "Pre-commit hooks with ruff and mypy for the backend.",
        ],
      },
      {
        title: "Bug fixes",
        items: [
          "Fixed session expiry guard detecting RefreshAccessTokenError and auto-redirecting to login.",
          "Fixed HttpUrl crash in class tree sort keys.",
          "Fixed stale search/autocomplete responses with proper IRI handling.",
          "Fixed language flag alignment with invisible placeholders.",
          "Fixed falsy 0.0 similarity lookup in semantic search.",
          "Fixed beacon token payload type validation.",
          "Fixed branch cleanup on suggestion commit failures.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-18",
    categories: [
      {
        title: "New features",
        items: [
          "Initial release of OntoKit as a standalone package.",
          "Renamed package from 'app' to 'ontokit' with consistent module imports.",
          "Added CLI entry point ('ontokit' command) installed via pyproject.toml scripts.",
          "Weblate-style version management in ontokit/version.py with dynamic version in pyproject.toml via hatch.",
          "CI/CD pipeline with GitHub Actions: lint, test, build, and publish to PyPI on tagged releases.",
          "Docker image publishing as part of the release workflow.",
          "Bare git repository service using pygit2 for concurrent access to ontology projects.",
          "Three-panel ontology editor with class tree, detail panel, and Turtle source editor.",
          "Branch-based workflow with pull requests for collaborative ontology editing.",
          "Ontology health check (linter) with 20+ semantic validation rules.",
          "Role-based access control with Owner, Admin, Editor, and Viewer roles.",
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="container mx-auto px-4 py-8 flex gap-8">
      <ChangelogToc
        entries={changelog.map(({ version, date }) => ({ version, date }))}
      />
      <div className="min-w-0 flex-1 max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Changelog
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Summary of changes for each release.
        </p>

        <div className="space-y-8">
          {changelog.map((entry) => (
            <section
              key={entry.version}
              id={changelogAnchorId(entry.version)}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 scroll-mt-4"
            >
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {entry.version}
                </h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {entry.date}
                </span>
              </div>

              <div className="space-y-4">
                {entry.categories.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                      {category.title}
                    </h3>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 text-sm space-y-1">
                      {category.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

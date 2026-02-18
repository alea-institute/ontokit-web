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
    version: "0.1.0",
    date: "2025-06-15",
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Changelog
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Summary of changes for each release.
      </p>

      <div className="space-y-8">
        {changelog.map((entry) => (
          <div
            key={entry.version}
            className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6"
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
          </div>
        ))}
      </div>
    </div>
  );
}

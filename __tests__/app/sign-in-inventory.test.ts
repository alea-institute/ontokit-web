import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Repository inventory of sign-in call sites (auth-mode matrix plan, U3 / R6).
 *
 * Provider-less deployments (optional mode without Zitadel, and disabled mode)
 * must never offer a sign-in that cannot succeed. Every sign-in call site in
 * `app/` and `components/` is listed here with the reason it is safe in those
 * modes. A new call site, or an extra one in a listed file, fails this test
 * until it is gated and added to the inventory deliberately.
 */

type Kind =
  /** `import { signIn } from "next-auth/react"` (catches aliased or passed-by-reference use). */
  | "signIn-import"
  /** A `signIn(` call. */
  | "signIn-call"
  /** A string literal starting with `/auth/signin` (links and navigations). */
  | "signin-route"
  /** A provider button label such as "Sign in with Zitadel". */
  | "provider-button";

type Gate =
  /** Rendered or invoked only when `shouldShowAuthUI()` is true. */
  | "shouldShowAuthUI"
  /** Fires only for a real provider-issued session, which cannot exist without a provider. */
  | "provider-session-only"
  /** Navigates to `/auth/signin`, which itself explains unavailability when no provider is active. */
  | "lands-on-gated-page"
  /** Known ungated site outside the U3 file list; tracked so it cannot grow unnoticed. */
  | "ungated-known-gap";

interface Entry {
  file: string;
  route: string;
  gate: Gate;
  counts: Partial<Record<Kind, number>>;
  note?: string;
}

const SIGN_IN_INVENTORY: Entry[] = [
  { file: "app/page.tsx", route: "/", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1 } },
  { file: "app/auth/signin/page.tsx", route: "/auth/signin", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "provider-button": 1 } },
  { file: "app/projects/new/page.tsx", route: "/projects/new", gate: "shouldShowAuthUI", counts: { "signin-route": 1 } },
  { file: "app/projects/[id]/page.tsx", route: "/projects/[id]", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 2 } },
  { file: "app/projects/[id]/editor/page.tsx", route: "/projects/[id]/editor", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 6 } },
  { file: "components/auth/user-menu.tsx", route: "(header, every page)", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1 } },
  {
    file: "components/auth/SessionGuard.tsx", route: "(providers, every page)", gate: "provider-session-only",
    counts: { "signIn-import": 1, "signIn-call": 1 },
    note: "Triggers only on session.error === RefreshAccessTokenError, which requires a provider-issued session.",
  },
  {
    file: "app/auth/error/page.tsx", route: "/auth/error", gate: "lands-on-gated-page",
    counts: { "signin-route": 2 },
    note: "Retry navigates to /auth/signin, which shows the unavailability copy when no provider is active.",
  },
  {
    file: "app/pr-party/settings/page.tsx", route: "/pr-party/settings", gate: "ungated-known-gap",
    counts: { "signIn-import": 1, "signIn-call": 1 },
    note: "Outside the U3 file list. Reachable only by direct URL: the Review nav link is reviewer-only.",
  },
  {
    file: "components/pr-party/PRPartyQueueView.tsx", route: "/pr-party", gate: "ungated-known-gap",
    counts: { "signIn-import": 1, "signIn-call": 1 },
    note: "Outside the U3 file list. Reachable only by direct URL: the Review nav link is reviewer-only.",
  },
];

const PATTERNS: Record<Kind, RegExp> = {
  "signIn-import": /import\s*\{[^}]*\bsignIn\b[^}]*\}\s*from\s*["']next-auth\/react["']/g,
  "signIn-call": /\bsignIn\s*\(/g,
  "signin-route": /["'`]\/auth\/signin\b/g,
  "provider-button": /Sign in with\s+[A-Z]\w*/g,
};

const KINDS = Object.keys(PATTERNS) as Kind[];
const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["app", "components"];

interface SourceFile { path: string; content: string }

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function readTree(): SourceFile[] {
  return SCAN_DIRS.flatMap(dir => listSources(path.join(ROOT, dir))).map(full => ({
    path: path.relative(ROOT, full).split(path.sep).join("/"),
    content: readFileSync(full, "utf8"),
  }));
}

/** Count sign-in call sites per file; files with none are omitted. */
function scanSignInCallSites(files: SourceFile[]): Map<string, Partial<Record<Kind, number>>> {
  const found = new Map<string, Partial<Record<Kind, number>>>();
  for (const file of files) {
    const counts: Partial<Record<Kind, number>> = {};
    for (const kind of KINDS) {
      const n = file.content.match(PATTERNS[kind])?.length ?? 0;
      if (n > 0) counts[kind] = n;
    }
    if (Object.keys(counts).length > 0) found.set(file.path, counts);
  }
  return found;
}

/** Human-readable differences between scanned call sites and the inventory. */
function diffAgainstInventory(found: Map<string, Partial<Record<Kind, number>>>, inventory: Entry[] = SIGN_IN_INVENTORY): string[] {
  const problems: string[] = [];
  const byFile = new Map(inventory.map(entry => [entry.file, entry]));
  for (const [file, counts] of found) {
    const entry = byFile.get(file);
    if (!entry) {
      problems.push(`${file}: uninventoried sign-in call site(s) ${JSON.stringify(counts)}`);
      continue;
    }
    for (const kind of KINDS) {
      const actual = counts[kind] ?? 0;
      const expected = entry.counts[kind] ?? 0;
      if (actual !== expected) problems.push(`${file}: ${kind} count ${actual}, inventory says ${expected}`);
    }
  }
  for (const entry of inventory) {
    if (!found.has(entry.file)) problems.push(`${entry.file}: inventoried but no sign-in call site found (stale entry)`);
  }
  return problems;
}

describe("sign-in call-site inventory", () => {
  const tree = readTree();

  it("scans a non-trivial tree", () => {
    expect(tree.length).toBeGreaterThan(50);
  });

  it("matches the checked-in inventory exactly", () => {
    expect(diffAgainstInventory(scanSignInCallSites(tree))).toEqual([]);
  });

  it("gates every shouldShowAuthUI entry on the shared client predicate", () => {
    for (const entry of SIGN_IN_INVENTORY.filter(e => e.gate === "shouldShowAuthUI")) {
      const content = tree.find(f => f.path === entry.file)?.content ?? "";
      expect(content, entry.file).toMatch(/import\s*\{[^}]*\bshouldShowAuthUI\b[^}]*\}\s*from\s*["']@\/lib\/auth-mode["']/);
      expect(content, entry.file).toMatch(/\bshouldShowAuthUI\(\)/);
    }
  });

  it("explains every entry that is not gated on shouldShowAuthUI", () => {
    for (const entry of SIGN_IN_INVENTORY.filter(e => e.gate !== "shouldShowAuthUI")) {
      expect(entry.note, entry.file).toBeTruthy();
    }
    // Growing the list of known-ungated sites must be a deliberate edit here.
    expect(SIGN_IN_INVENTORY.filter(e => e.gate === "ungated-known-gap").map(e => e.file)).toEqual([
      "app/pr-party/settings/page.tsx",
      "components/pr-party/PRPartyQueueView.tsx",
    ]);
  });

  it("fails when a new file adds an uninventoried signIn( call", () => {
    const fixture = { path: "components/fixture/NewPrompt.tsx", content: 'import { signIn } from "next-auth/react";\nexport const Prompt = () => <button onClick={() => signIn("zitadel")}>Sign In</button>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'components/fixture/NewPrompt.tsx: uninventoried sign-in call site(s) {"signIn-import":1,"signIn-call":1}',
    ]);
  });

  it("fails when a new file links to /auth/signin", () => {
    const fixture = { path: "app/fixture/page.tsx", content: 'export default () => <Link href="/auth/signin?callbackUrl=%2F">Sign In</Link>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'app/fixture/page.tsx: uninventoried sign-in call site(s) {"signin-route":1}',
    ]);
  });

  it("fails when a new file passes signIn by reference or renders a provider button", () => {
    const fixture = { path: "components/fixture/Ref.tsx", content: 'import { useSession, signIn as login } from "next-auth/react";\nexport const Ref = () => <button onClick={login}>Sign in with GitHub</button>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'components/fixture/Ref.tsx: uninventoried sign-in call site(s) {"signIn-import":1,"provider-button":1}',
    ]);
  });

  it("fails when an inventoried file gains an extra sign-in call site", () => {
    const withExtra = tree.map(f => f.path === "app/page.tsx" ? { ...f, content: f.content + '\nconst extra = () => signIn("zitadel");\n' } : f);
    expect(diffAgainstInventory(scanSignInCallSites(withExtra))).toEqual([
      "app/page.tsx: signIn-call count 2, inventory says 1",
    ]);
  });
});

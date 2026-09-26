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
  | "provider-button"
  /**
   * Visible sign-in wording outside comments: "Sign in", "Sign In", "sign-in",
   * "Try signing in again". Catches a control whose action is a plain router
   * push rather than a signIn( call or an /auth/signin literal.
   */
  | "sign-in-copy";

type Gate =
  /** Rendered or invoked only when `shouldShowAuthUI()` is true. */
  | "shouldShowAuthUI"
  /** Fires only for a real provider-issued session, which cannot exist without a provider. */
  | "provider-session-only"
  /** Navigates to `/auth/signin`, which itself explains unavailability when no provider is active. */
  | "lands-on-gated-page"
  /** A presentational component that renders its sign-in control only when the parent supplies a callback or flag the parent derives from `shouldShowAuthUI()`. */
  | "parent-gated"
  /** Explanatory wording only; the file renders no sign-in control. */
  | "copy-only"
  /** Known ungated site; none may exist (R6). Kept so a regression must be declared, and fails the test. */
  | "ungated-known-gap";

interface Entry {
  file: string;
  route: string;
  gate: Gate;
  counts: Partial<Record<Kind, number>>;
  note?: string;
}

const SIGN_IN_INVENTORY: Entry[] = [
  { file: "app/page.tsx", route: "/", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "sign-in-copy": 4 } },
  { file: "app/auth/signin/page.tsx", route: "/auth/signin", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "provider-button": 1, "sign-in-copy": 8 } },
  { file: "app/projects/new/page.tsx", route: "/projects/new", gate: "shouldShowAuthUI", counts: { "signin-route": 1, "sign-in-copy": 3 } },
  { file: "app/projects/[id]/page.tsx", route: "/projects/[id]", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 2, "sign-in-copy": 6 } },
  { file: "app/projects/[id]/editor/page.tsx", route: "/projects/[id]/editor", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 6, "sign-in-copy": 3 } },
  { file: "components/auth/user-menu.tsx", route: "(header, every page)", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "sign-in-copy": 1 } },
  {
    file: "components/auth/SessionGuard.tsx", route: "(providers, every page)", gate: "provider-session-only",
    counts: { "signIn-import": 1, "signIn-call": 1 },
    note: "Triggers only on session.error === RefreshAccessTokenError, which requires a provider-issued session.",
  },
  {
    file: "app/auth/error/page.tsx", route: "/auth/error", gate: "shouldShowAuthUI",
    counts: { "signin-route": 2, "sign-in-copy": 4 },
    note: "Retry and the transient auto-retry run only with an active provider; otherwise the page says sign-in is unavailable.",
  },
  { file: "app/pr-party/settings/page.tsx", route: "/pr-party/settings", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "sign-in-copy": 3 } },
  { file: "components/pr-party/PRPartyQueueView.tsx", route: "/pr-party", gate: "shouldShowAuthUI", counts: { "signIn-import": 1, "signIn-call": 1, "sign-in-copy": 3 } },
  {
    file: "components/editor/ClassDetailPanel.tsx", route: "/projects/[id]/editor", gate: "parent-gated",
    counts: { "sign-in-copy": 4 },
    note: "Both sign-in buttons require showSignInToEdit, which the editor page derives from shouldShowAuthUI().",
  },
  {
    file: "components/editor/ProposalSubmittedDialog.tsx", route: "/projects/[id]/editor", gate: "parent-gated",
    counts: { "sign-in-copy": 1 },
    note: "The account button renders only when onSignIn is passed; the editor page passes it only when shouldShowAuthUI() is true.",
  },
  {
    file: "components/editor/TrustExplainer.tsx", route: "/projects/[id]/editor", gate: "parent-gated",
    counts: { "sign-in-copy": 3 },
    note: "Sign-in copy and button render only when gate.onSignIn is set, which the editor page sets only when shouldShowAuthUI() is true.",
  },
  {
    file: "app/docs/page.tsx", route: "/docs", gate: "copy-only",
    counts: { "sign-in-copy": 2 },
    note: "Documentation prose describing browsing without signing in; no control.",
  },
  {
    file: "app/settings/page.tsx", route: "/settings", gate: "copy-only",
    counts: { "sign-in-copy": 1 },
    note: "A 'Sign in required' heading with no control; the page is linked only from the provider-gated user menu.",
  },
];

const PATTERNS: Record<Kind, RegExp> = {
  "signIn-import": /import\s*\{[^}]*\bsignIn\b[^}]*\}\s*from\s*["']next-auth\/react["']/g,
  "signIn-call": /\bsignIn\s*\(/g,
  "signin-route": /["'`]\/auth\/signin\b/g,
  "provider-button": /Sign in with\s+[A-Z]\w*/g,
  "sign-in-copy": /\b[Ss]ign(?:ing)?[\s-][Ii]n\b/g,
};

/** Comments are not rendered, so wording in them is not an affordance. */
function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");
}

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
      const text = kind === "sign-in-copy" ? stripComments(file.content) : file.content;
      const n = text.match(PATTERNS[kind])?.length ?? 0;
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
    // R6: no sign-in control may be ungated in a provider-less mode.
    expect(SIGN_IN_INVENTORY.filter(e => e.gate === "ungated-known-gap").map(e => e.file)).toEqual([]);
  });

  it("fails when a new file adds an uninventoried signIn( call", () => {
    const fixture = { path: "components/fixture/NewPrompt.tsx", content: 'import { signIn } from "next-auth/react";\nexport const Prompt = () => <button onClick={() => signIn("zitadel")}>Sign In</button>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'components/fixture/NewPrompt.tsx: uninventoried sign-in call site(s) {"signIn-import":1,"signIn-call":1,"sign-in-copy":1}',
    ]);
  });

  it("fails when a new file links to /auth/signin", () => {
    const fixture = { path: "app/fixture/page.tsx", content: 'export default () => <Link href="/auth/signin?callbackUrl=%2F">Sign In</Link>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'app/fixture/page.tsx: uninventoried sign-in call site(s) {"signin-route":1,"sign-in-copy":1}',
    ]);
  });

  it("fails when a new file passes signIn by reference or renders a provider button", () => {
    const fixture = { path: "components/fixture/Ref.tsx", content: 'import { useSession, signIn as login } from "next-auth/react";\nexport const Ref = () => <button onClick={login}>Sign in with GitHub</button>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'components/fixture/Ref.tsx: uninventoried sign-in call site(s) {"signIn-import":1,"provider-button":1,"sign-in-copy":1}',
    ]);
  });

  it("fails when a new file renders sign-in wording on a control without a signIn( call", () => {
    const fixture = { path: "app/fixture/retry.tsx", content: 'export const Retry = () => <button onClick={() => router.push("/elsewhere")}>Try signing in again</button>;\n' };
    expect(diffAgainstInventory(scanSignInCallSites([...tree, fixture]))).toEqual([
      'app/fixture/retry.tsx: uninventoried sign-in call site(s) {"sign-in-copy":1}',
    ]);
  });

  it("counts Sign In, sign-in and signing in wording but ignores identifiers and comments", () => {
    const fixture = { path: "components/fixture/Copy.tsx", content: '// Sign in comment\n/* sign-in block */\nconst onSignIn = signInHandler;\nexport const A = () => <p>Sign In, sign-in, signing in</p>;\n' };
    expect(scanSignInCallSites([fixture]).get("components/fixture/Copy.tsx")).toEqual({ "sign-in-copy": 3 });
  });

  it("fails when an inventoried file gains extra sign-in wording", () => {
    const withExtra = tree.map(f => f.path === "app/auth/error/page.tsx" ? { ...f, content: f.content + '\nconst Extra = () => <a>Sign in again</a>;\n' } : f);
    expect(diffAgainstInventory(scanSignInCallSites(withExtra))).toEqual([
      "app/auth/error/page.tsx: sign-in-copy count 5, inventory says 4",
    ]);
  });

  it("fails when an inventoried file gains an extra sign-in call site", () => {
    const withExtra = tree.map(f => f.path === "app/page.tsx" ? { ...f, content: f.content + '\nconst extra = () => signIn("zitadel");\n' } : f);
    expect(diffAgainstInventory(scanSignInCallSites(withExtra))).toEqual([
      "app/page.tsx: signIn-call count 2, inventory says 1",
    ]);
  });
});

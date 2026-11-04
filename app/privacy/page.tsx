import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";

/*
 * APPROVED TEXT — rendered verbatim. Do not reword, reorder, or "improve"
 * any word, punctuation mark, or heading. The only addition is the mailto
 * link on the contact address. The approved source is kept byte-identical at
 * __tests__/fixtures/privacy-policy.md, and a test compares the two.
 */

export const metadata: Metadata = {
  title: "Privacy policy · OntoKit",
  description:
    "How OntoKit collects, uses, shares, and keeps personal data, and the choices you have.",
};

export const dynamic = "force-static";

const PRIVACY_EMAIL = "privacy@damienriehl.com";

function EmailLink() {
  return (
    <a
      href={`mailto:${PRIVACY_EMAIL}`}
      className="font-medium text-primary-600 underline underline-offset-2 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
    >
      {PRIVACY_EMAIL}
    </a>
  );
}

const h2 = "mt-10 text-xl font-semibold text-slate-900 dark:text-white";
const p = "mt-4";
const ul = "mt-4 list-disc space-y-2 pl-6";
const strong = "font-semibold text-slate-900 dark:text-white";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900"
      >
        <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            OntoKit privacy policy
          </h1>

          <p className={p}>
            <strong className={strong}>Last updated: November 4, 2026</strong>
          </p>

          <p className={p}>
            This policy covers OntoKit: the collaborative ontology platform, its websites, and the shared OntoKit sign-in that other community tools may use. It applies to every OntoKit site, including preview and demonstration sites such as{" "}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.9em] dark:bg-slate-800">
              ontokit-demo.damienriehl.com
            </code>
            , and to production sites as they launch. Communities use OntoKit to build open ontologies, including FOLIO and the Catholic Semantic Canon.
          </p>

          <h2 className={h2}>Who we are</h2>

          <p className={p}>
            The ALEA Institute and the Catholic Digital Commons Foundation (CDCF), a 501(c)(3) nonprofit, operate OntoKit together. ALEA stewards FOLIO; CDCF stewards the Catholic Semantic Canon. Each site names the organization responsible for it. Questions go to <EmailLink />.
          </p>

          <h2 className={h2}>What we collect</h2>

          <ul className={ul}>
            <li>
              <strong className={strong}>Account details.</strong>{" "}
              {"When you register, we store your name, email address, and password (as a secure hash, never in plain text). When you sign in with Google or GitHub, we receive your name, email address, profile picture, and that provider's account ID."}
            </li>
            <li>
              <strong className={strong}>Your contributions.</strong>{" "}
              We store the edits, suggestions, comments, and notes you submit, and any name or email you choose to attach to a suggestion.
            </li>
            <li>
              <strong className={strong}>Project roles.</strong>{" "}
              We record which projects you belong to and your role in each, such as contributor, reviewer, or administrator.
            </li>
            <li>
              <strong className={strong}>Technical data.</strong>{" "}
              We record IP addresses to limit abuse and enforce rate limits, and we keep them with anonymous suggestions. Cookies keep you signed in. Our network provider records basic, aggregate visit statistics.
            </li>
          </ul>

          <h2 className={h2}>How we use it</h2>

          <ul className={ul}>
            <li>To sign you in, across every tool that uses OntoKit sign-in, and keep your account secure.</li>
            <li>{"To show your contributions to a project's reviewers and credit you for accepted work."}</li>
            <li>To run, protect, and improve the service, including stopping spam and abuse.</li>
          </ul>

          <p className={p}>We never sell your data or use it for advertising.</p>

          <h2 className={h2}>What becomes public</h2>

          <p className={p}>
            {"Ontologies on OntoKit stay open. When a reviewer accepts a change, it joins the project's public history, which may include a public GitHub repository. Those commits credit the name you chose, or \"Anonymous\", and use a no-reply address, never your email."}
          </p>

          <h2 className={h2}>Services we rely on</h2>

          <ul className={ul}>
            <li>
              <strong className={strong}>Cloud hosting providers</strong>{" "}
              run our servers and databases; today, Hetzner in the European Union.
            </li>
            <li>
              <strong className={strong}>Cloudflare</strong> routes and protects traffic.
            </li>
            <li>
              <strong className={strong}>GitHub</strong> stores public copies of project ontologies.
            </li>
            <li>
              <strong className={strong}>Google</strong> and{" "}
              <strong className={strong}>GitHub</strong> handle sign-in when you choose them.
            </li>
            <li>
              <strong className={strong}>AI providers</strong>, today Anthropic, process ontology text when a project administrator uses AI assist. We send no account data to AI providers.
            </li>
          </ul>

          <h2 className={h2}>How long we keep it</h2>

          <p className={p}>
            We keep account and contribution data while your account stays active. Preview and demonstration sites may reset their data at any time. Ask us, and we will delete your account and the personal details attached to your contributions. Public project history may keep accepted changes, credited without your email.
          </p>

          <h2 className={h2}>Your choices</h2>

          <p className={p}>
            You may browse without an account and suggest edits without giving a name or email. To see, correct, export, or delete your data, email <EmailLink />.
          </p>

          <h2 className={h2}>Changes</h2>

          <p className={p}>
            When this policy changes, we will update the date above and, for significant changes, notify account holders.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

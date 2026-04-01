"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

const docsNavLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/guide", label: "Ontology Guide" },
  { href: "/docs/changelog", label: "Changelog" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <Header />
      <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto flex items-center gap-4 px-4">
          {docsNavLinks.map(({ href, label }) => {
            const isActive =
              href === "/docs" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium py-2.5 border-b-2 transition-colors",
                  isActive
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        {children}
      </main>
    </>
  );
}

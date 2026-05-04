"use client";

import { useEffect } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import "./scalar-overrides.css";
import { Header } from "@/components/layout/header";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Sync Scalar's dark mode (body.dark-mode / body.light-mode) with the app's
 * theme (html.dark).  Scalar reads body classes internally, so we mirror the
 * html class onto body whenever it changes.
 */
function useSyncScalarDarkMode() {
  useEffect(() => {
    const root = document.documentElement;

    function sync() {
      const isDark = root.classList.contains("dark");
      document.body.classList.toggle("dark-mode", isDark);
      document.body.classList.toggle("light-mode", !isDark);
    }

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
}

export default function ApiDocsPage() {
  useSyncScalarDarkMode();

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="scalar-container">
        <ApiReferenceReact
          configuration={{
            url: `${API_BASE_URL}/openapi.json`,
            servers: [{ url: API_BASE_URL }],
            theme: "kepler",
            hideModels: false,
            hideDownloadButton: false,
            hideDarkModeToggle: true,
            metaData: {
              title: "OntoKit API Documentation",
            },
          }}
        />
      </div>
    </div>
  );
}

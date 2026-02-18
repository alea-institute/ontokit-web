"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import "./scalar-overrides.css";
import { Header } from "@/components/layout/header";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ApiDocsPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="scalar-container">
        <ApiReferenceReact
          configuration={{
            url: `${API_BASE_URL}/openapi.json`,
            theme: "kepler",
            hideModels: false,
            hideDownloadButton: false,
            hideDarkModeToggle: false,
            metaData: {
              title: "OntoKit API Documentation",
            },
          }}
        />
      </div>
    </div>
  );
}

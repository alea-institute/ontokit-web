"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { Header } from "@/components/layout/header";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ApiDocsPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ApiReferenceReact
          configuration={{
            url: `${API_BASE_URL}/openapi.json`,
            theme: "kepler",
            hideModels: false,
            hideDownloadButton: false,
            darkMode: true,
            metaData: {
              title: "Axigraph API Documentation",
            },
          }}
        />
      </div>
    </div>
  );
}

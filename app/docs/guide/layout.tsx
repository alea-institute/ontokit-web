"use client";

import { GuideSidebar } from "@/components/docs/GuideSidebar";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8 flex gap-8">
      <GuideSidebar />
      <div className="min-w-0 max-w-3xl flex-1">{children}</div>
    </div>
  );
}

import type { ReactNode } from "react";

import { DemoProjectBanner } from "@/components/projects/demo-project-banner";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DemoProjectBanner />
    </>
  );
}

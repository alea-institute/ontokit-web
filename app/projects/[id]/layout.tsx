import type { ReactNode } from "react";

import { DemoProjectShell } from "@/components/projects/demo-project-banner";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <DemoProjectShell>{children}</DemoProjectShell>;
}

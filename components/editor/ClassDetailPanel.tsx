"use client";

import { useState, useEffect } from "react";
import { ExternalLink, AlertTriangle, Info, Tag, MessageSquare, ArrowUp, FileText, XCircle } from "lucide-react";
import { projectOntologyApi, type OWLClassDetail } from "@/lib/api/client";
import { lintApi, type LintIssue } from "@/lib/api/lint";
import { cn, getLocalName, getPreferredLabel } from "@/lib/utils";

interface ClassDetailPanelProps {
  projectId: string;
  classIri: string | null;
  accessToken?: string;
  onNavigateToClass?: (iri: string) => void;
}

export function ClassDetailPanel({
  projectId,
  classIri,
  accessToken,
  onNavigateToClass,
}: ClassDetailPanelProps) {
  const [classDetail, setClassDetail] = useState<OWLClassDetail | null>(null);
  const [classIssues, setClassIssues] = useState<LintIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classIri) {
      setClassDetail(null);
      setClassIssues([]);
      return;
    }

    const fetchClassData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch class details and issues in parallel
        const [detail, issuesResponse] = await Promise.all([
          projectOntologyApi.getClassDetail(projectId, classIri, accessToken),
          lintApi.getIssues(projectId, accessToken, { subject_iri: classIri, limit: 50 }).catch(() => ({ items: [] })),
        ]);
        setClassDetail(detail);
        setClassIssues(issuesResponse.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load class details";
        setError(message);
        setClassDetail(null);
        setClassIssues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassData();
  }, [projectId, classIri, accessToken]);

  if (!classIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Info className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Select a class from the tree to view its details
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/50 dark:bg-red-900/20">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!classDetail) {
    return null;
  }

  const displayLabel = getPreferredLabel(classDetail.labels) || getLocalName(classDetail.iri);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-owl-class/20 border border-owl-class">
            <span className="text-sm font-bold text-owl-class">C</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {displayLabel}
              {classDetail.deprecated && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Deprecated
                </span>
              )}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={classDetail.iri}>
              {classDetail.iri}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Lint Issues */}
        {classIssues.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Health Issues ({classIssues.length})
            </h3>
            <div className="space-y-2">
              {classIssues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Labels */}
        {classDetail.labels.length > 0 && (
          <Section title="Labels" icon={<Tag className="h-4 w-4" />}>
            <div className="space-y-2">
              {classDetail.labels.map((label, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{label.value}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {label.lang}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Comments/Descriptions */}
        {classDetail.comments.length > 0 && (
          <Section title="Description" icon={<MessageSquare className="h-4 w-4" />}>
            <div className="space-y-3">
              {classDetail.comments.map((comment, index) => (
                <div key={index}>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{comment.value}</p>
                  <span className="text-xs text-slate-400 dark:text-slate-500">({comment.lang})</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Annotations (DC, SKOS, etc.) */}
        {classDetail.annotations && classDetail.annotations.length > 0 && (
          <Section title="Annotations" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-4">
              {classDetail.annotations.map((annotation, index) => (
                <div key={index}>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {annotation.property_label}
                  </p>
                  <div className="mt-1 space-y-1">
                    {annotation.values.map((val, vIndex) => (
                      <div key={vIndex} className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {val.value}
                        </span>
                        {val.lang && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {val.lang}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Parent Classes */}
        {classDetail.parent_iris.length > 0 && (
          <Section title="Superclasses" icon={<ArrowUp className="h-4 w-4" />}>
            <div className="space-y-1">
              {classDetail.parent_iris.map((parentIri) => (
                <IriLink
                  key={parentIri}
                  iri={parentIri}
                  label={classDetail.parent_labels?.[parentIri]}
                  onClick={onNavigateToClass}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Statistics */}
        <Section title="Statistics" icon={<Info className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Subclasses" value={classDetail.child_count} />
            <StatItem label="Instances" value={classDetail.instance_count} />
          </div>
        </Section>

        {/* Equivalent Classes */}
        {classDetail.equivalent_iris.length > 0 && (
          <Section title="Equivalent Classes">
            <div className="space-y-1">
              {classDetail.equivalent_iris.map((iri) => (
                <IriLink key={iri} iri={iri} onClick={onNavigateToClass} />
              ))}
            </div>
          </Section>
        )}

        {/* Disjoint Classes */}
        {classDetail.disjoint_iris.length > 0 && (
          <Section title="Disjoint With">
            <div className="space-y-1">
              {classDetail.disjoint_iris.map((iri) => (
                <IriLink key={iri} iri={iri} onClick={onNavigateToClass} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

interface IriLinkProps {
  iri: string;
  label?: string;  // Resolved label, if available
  onClick?: (iri: string) => void;
}

function IriLink({ iri, label, onClick }: IriLinkProps) {
  // Use provided label, or fall back to local name from IRI
  const displayLabel = label || getLocalName(iri);

  return (
    <button
      onClick={() => onClick?.(iri)}
      className={cn(
        "flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300",
        !onClick && "cursor-default hover:no-underline"
      )}
      title={iri}
      disabled={!onClick}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
        <span className="text-[9px] font-bold text-owl-class">C</span>
      </span>
      {displayLabel}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </button>
  );
}

interface StatItemProps {
  label: string;
  value: number;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

interface IssueItemProps {
  issue: LintIssue;
}

const issueIcons = {
  error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  info: <Info className="h-3.5 w-3.5 text-blue-500" />,
};

const issueColors = {
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function IssueItem({ issue }: IssueItemProps) {
  return (
    <div className={cn("rounded-md px-2.5 py-1.5 text-xs", issueColors[issue.issue_type])}>
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 shrink-0">{issueIcons[issue.issue_type]}</span>
        <div>
          <span className="font-medium">{issue.rule_id}:</span>{" "}
          <span>{issue.message}</span>
        </div>
      </div>
    </div>
  );
}

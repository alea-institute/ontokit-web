"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Minus, Pencil, Plus, Timer } from "lucide-react";
import type { ChangeEventType } from "@/lib/api/analytics";
import type { ChangeEntityType, EntityChange, FieldChange, NetChange } from "@/lib/api/changes";
import { buildSelectionQuery } from "@/lib/utils/selectionUrl";
import { cn, getLocalName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OriginBadge } from "./OriginBadge";

export const ENTITY_TYPE_LABELS: Record<ChangeEntityType, string> = {
  class: "Class",
  object_property: "Object property",
  data_property: "Data property",
  annotation_property: "Annotation property",
  individual: "Individual",
};

export const NET_CHANGES = {
  added: { label: "Added", icon: Plus, color: "text-green-700 dark:text-green-400" },
  modified: { label: "Modified", icon: Pencil, color: "text-blue-700 dark:text-blue-400" },
  removed: { label: "Removed", icon: Minus, color: "text-red-700 dark:text-red-400" },
  transient: { label: "Added, then removed", icon: Timer, color: "text-slate-700 dark:text-slate-300" },
} satisfies Record<NetChange, { label: string; icon: typeof Plus; color: string }>;

const FIELD_LABELS: Record<FieldChange["field"], string> = {
  labels: "Labels",
  definitions: "Definitions",
  parents: "Parents",
  deprecated: "Deprecated",
  comments: "Comments",
  other: "Other",
};

const EVENT_LABELS: Record<ChangeEventType, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  rename: "Label changed",
  reparent: "Reparented",
  deprecate: "Deprecated",
};

function ChangeTime({ timestamp, referenceTime }: { timestamp: string; referenceTime: number }) {
  const date = new Date(timestamp);
  const minutes = Math.max(0, Math.floor((referenceTime - date.getTime()) / 60_000));
  const relativeTime = minutes === 0 ? "just now"
    : minutes < 60 ? `${minutes}m ago`
    : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago`
    : `${Math.floor(minutes / 1440)}d ago`;

  return (
    <time
      dateTime={timestamp}
      title={date.toLocaleString()}
      className="shrink-0"
    >
      {relativeTime}
    </time>
  );
}

function fieldValues(value: FieldChange["before"]): string[] {
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  return [value ? "Yes" : "No"];
}

function FieldValues({
  values,
  otherValues,
  field,
  side,
}: {
  values: string[];
  otherValues: string[];
  field: FieldChange["field"];
  side: "before" | "after";
}) {
  const removed = side === "before";
  const Marker = removed ? Minus : Plus;
  const Markup = removed ? "del" : "ins";

  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{removed ? "Before" : "After"}</p>
      {values.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">None</p>
      ) : (
        <ul className="space-y-1">
          {values.map((value, index) => {
            const isParent = field === "parents";
            const text = <span title={isParent ? value : undefined}>{isParent ? getLocalName(value) : value}</span>;
            return (
              <li key={index} className="wrap-break-word text-sm text-slate-700 dark:text-slate-300">
                {otherValues.includes(value) ? text : (
                  <Markup
                    className={cn(
                      "flex items-start gap-1.5",
                      removed
                        ? "text-red-700 line-through dark:text-red-400"
                        : "text-green-700 no-underline dark:text-green-400",
                    )}
                  >
                    <Marker aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="sr-only">{removed ? "Removed: " : "Added: "}</span>
                    {text}
                  </Markup>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ChangeRow({
  item,
  projectId,
  branch,
  referenceTime,
}: {
  item: EntityChange;
  projectId: string;
  branch: string;
  referenceTime: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const label = item.label || getLocalName(item.entity_iri);
  const { icon: ChangeIcon, label: changeLabel, color } = NET_CHANGES[item.net_change];
  const hasEditorLink = item.net_change === "added" || item.net_change === "modified";
  const DisclosureIcon = expanded ? ChevronDown : ChevronRight;
  const selectionType = item.entity_type === "class" || item.entity_type === "individual"
    ? item.entity_type
    : "property";
  const selection = buildSelectionQuery({ iri: item.entity_iri, type: selectionType });
  const editorHref = `/projects/${projectId}/editor${selection}&branch=${encodeURIComponent(branch)}`;

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn("inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-medium sm:w-32", color)}>
          <ChangeIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {changeLabel}
        </span>
        <div className="min-w-0 flex-1 basis-36">
          {hasEditorLink ? (
            <Link
              href={editorHref}
              className="wrap-break-word rounded-sm text-sm font-semibold text-primary-700 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:focus-visible:ring-primary-400"
            >
              {label}
            </Link>
          ) : (
            <span className="wrap-break-word text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">{ENTITY_TYPE_LABELS[item.entity_type]}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.origins.map((origin) => <OriginBadge key={origin} origin={origin} />)}
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-2 text-xs text-slate-600 dark:text-slate-400">
          {item.authors.length > 0 && (
            <span className="wrap-break-word">{item.authors.map((author) => author.user_name || author.user_id).join(", ")}</span>
          )}
          <ChangeTime timestamp={item.last_changed_at} referenceTime={referenceTime} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Details for ${label}`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="gap-1.5 text-slate-700 focus-visible:ring-primary-500 dark:text-slate-300 dark:focus-visible:ring-primary-400"
          onClick={() => setExpanded(!expanded)}
        >
          <DisclosureIcon aria-hidden="true" className="h-4 w-4" />
          Details ({item.event_count})
        </Button>
      </div>

      <div id={detailsId} hidden={!expanded}>
        {expanded && (
          <div className="mt-3 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            {item.field_changes.length > 0 && (
              <ul className="space-y-3">
                {item.field_changes.map(({ field, before, after }) => (
                  <li key={field} className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{FIELD_LABELS[field]}</h3>
                    {field === "other" ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Values unavailable for this field.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                        <FieldValues values={fieldValues(before)} otherValues={fieldValues(after)} field={field} side="before" />
                        <ArrowRight aria-hidden="true" className="mt-1 hidden h-4 w-4 text-slate-500 sm:block dark:text-slate-400" />
                        <FieldValues values={fieldValues(after)} otherValues={fieldValues(before)} field={field} side="after" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Events</h3>
              {item.event_count > item.events.length && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing the {item.events.length} most recent events.
                </p>
              )}
              <ul className="space-y-2">
                {item.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {EVENT_LABELS[event.event_type] || event.event_type}
                    </span>
                    <span className="wrap-break-word">{event.user_name || event.user_id || "Unknown author"}</span>
                    <ChangeTime timestamp={event.created_at} referenceTime={referenceTime} />
                    <OriginBadge origin={event.origin} />
                    {event.origin_model && <span className="wrap-break-word">{event.origin_model}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

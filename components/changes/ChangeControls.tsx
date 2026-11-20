"use client";

import { Check, HelpCircle } from "lucide-react";
import { Fragment, useId, useRef, useState, type ComponentPropsWithRef, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/button";
import type { ChangeEntityType, ChangeOrigin, NetChange, ProjectChangesResponse } from "@/lib/api/changes";
import { cn } from "@/lib/utils";
import { ENTITY_TYPE_LABELS, NET_CHANGES } from "./ChangeRow";
import { ORIGIN_LABELS } from "./OriginBadge";

export const CHANGE_WINDOWS = [1, 7, 30, 90] as const;
export const DEFAULT_CHANGE_WINDOW = 7;

export function TimeWindow({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <fieldset role="radiogroup" aria-labelledby="change-window-label">
      <legend id="change-window-label" className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        Time window
      </legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {CHANGE_WINDOWS.map((preset) => (
          <label key={preset} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="change-window"
              checked={days === preset}
              onChange={() => onChange(preset)}
            />
            <span className="block rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 peer-checked:bg-primary-50 peer-checked:font-semibold peer-checked:text-primary-700 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:peer-checked:bg-primary-900/30 dark:peer-checked:text-primary-400 dark:peer-focus-visible:ring-primary-400">
              {preset === 1 ? "Last 24 hours" : `${preset} days`}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ChangeHelp() {
  const [expanded, setExpanded] = useState(false);
  const helpId = useId();

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        aria-controls={helpId}
        onClick={() => setExpanded(!expanded)}
        className="gap-1.5 text-primary-700 focus-visible:ring-primary-500 dark:text-primary-400 dark:focus-visible:ring-primary-400"
      >
        <HelpCircle aria-hidden="true" className="h-4 w-4" />
        How changes are tracked
      </Button>
      <div id={helpId} hidden={!expanded} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <p>Renaming an entity&apos;s IRI shows as one removal plus one addition. Origin and author filters select entities and each result summarizes changes across the full window.</p>
        <p>Windows count back from each request in 24-hour periods in UTC. Times are shown in your local time zone.</p>
        <p>AI origin tracks class creation only. It reflects a match to a stored suggestion at creation time. AI-suggested annotations, parents, and edges on existing entities are not tracked.</p>
      </div>
    </div>
  );
}

function FilterChip({
  pressed,
  children,
  className,
  ...props
}: ComponentPropsWithRef<"button"> & { pressed: boolean; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      className={cn(
        "gap-1.5 text-slate-700 focus-visible:ring-primary-500 dark:text-slate-200 dark:focus-visible:ring-primary-400",
        pressed && "border-primary-500 bg-primary-50 font-semibold text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-400",
        className,
      )}
      {...props}
    >
      {pressed && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </Button>
  );
}

export function ChangeSummary({
  summary,
  origins,
  netChanges,
  onOrigin,
  onNetChange,
  onAllNetChanges,
}: {
  summary?: ProjectChangesResponse["summary"];
  origins: readonly ChangeOrigin[];
  netChanges: readonly NetChange[];
  onOrigin: (origin: ChangeOrigin) => void;
  onNetChange: (change: NetChange) => void;
  onAllNetChanges: () => void;
}) {
  const entityCount = summary?.entities_changed;
  const originCountId = useId();

  return (
    <section aria-label="Change summary" className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Net change</legend>
        <div className="flex flex-wrap gap-2">
          <FilterChip pressed={!netChanges.length} onClick={onAllNetChanges}>
            {entityCount ?? "—"} {entityCount === 1 ? "entity" : "entities"} changed
          </FilterChip>
          {(Object.keys(NET_CHANGES) as NetChange[]).map((change) => {
            const { label, icon: Icon, color } = NET_CHANGES[change];
            return (
              <FilterChip key={change} pressed={netChanges.includes(change)} onClick={() => onNetChange(change)}>
                <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", color)} />
                {summary?.by_net_change[change] ?? "—"} {label}
              </FilterChip>
            );
          })}
        </div>
      </fieldset>
      <fieldset aria-label="Origin" className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Events by origin</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORIGIN_LABELS) as ChangeOrigin[]).map((origin) => {
            const count = summary?.by_origin[origin];
            const countId = `${originCountId}-${origin}`;
            return (
              <Fragment key={origin}>
                <FilterChip
                  pressed={origins.includes(origin)}
                  onClick={() => onOrigin(origin)}
                  aria-describedby={count === undefined ? undefined : countId}
                >
                  <span aria-hidden="true">{count ?? "—"}</span>
                  {ORIGIN_LABELS[origin]}
                </FilterChip>
                {count !== undefined && <span id={countId} className="sr-only">{`${count} ${count === 1 ? "event" : "events"}`}</span>}
              </Fragment>
            );
          })}
        </div>
      </fieldset>
      {netChanges.length > 0 && (
        <p className="w-full text-sm text-slate-600 dark:text-slate-400">
          Summary counts cover the full window across all change kinds.
        </p>
      )}
    </section>
  );
}

function FilterGroup<Value extends string>({
  label,
  values,
  options,
  onToggle,
  firstChipRef,
}: {
  label: string;
  values: readonly Value[];
  options: readonly { value: Value; label: string }[];
  onToggle: (value: Value) => void;
  firstChipRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }, index) => (
          <FilterChip
            key={value}
            ref={index === 0 ? firstChipRef : undefined}
            pressed={values.includes(value)}
            onClick={() => onToggle(value)}
            className="h-auto min-h-8 max-w-full py-1 text-start wrap-anywhere"
          >
            {label}
          </FilterChip>
        ))}
      </div>
    </fieldset>
  );
}

export type ChangeFilterValues = {
  origin: ChangeOrigin;
  author: string;
  entity_type: ChangeEntityType;
  net_change: NetChange;
};

export type SelectedChangeFilters = {
  [Key in keyof ChangeFilterValues]: ChangeFilterValues[Key][];
};

export function ChangeFilters({
  selected,
  authors,
  hasFilters,
  onToggle,
  onClear,
}: {
  selected: SelectedChangeFilters;
  authors: { value: string; label: string }[];
  hasFilters: boolean;
  onToggle: <Key extends keyof ChangeFilterValues>(key: Key, value: ChangeFilterValues[Key]) => void;
  onClear: () => void;
}) {
  const firstOrigin = useRef<HTMLButtonElement>(null);

  return (
    <section aria-labelledby="change-filters-heading" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="change-filters-heading" className="font-semibold text-slate-900 dark:text-white">Filters</h2>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary-700 focus-visible:ring-primary-500 dark:text-primary-400 dark:focus-visible:ring-primary-400"
            onClick={() => {
              onClear();
              firstOrigin.current?.focus();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FilterGroup
          label="Origin"
          firstChipRef={firstOrigin}
          values={selected.origin}
          options={(Object.keys(ORIGIN_LABELS) as ChangeOrigin[]).map((value) => ({ value, label: ORIGIN_LABELS[value] }))}
          onToggle={(value) => onToggle("origin", value)}
        />
        {authors.length > 0 && (
          <FilterGroup label="Author" values={selected.author} options={authors} onToggle={(value) => onToggle("author", value)} />
        )}
        <FilterGroup
          label="Entity type"
          values={selected.entity_type}
          options={(Object.keys(ENTITY_TYPE_LABELS) as ChangeEntityType[]).map((value) => ({ value, label: ENTITY_TYPE_LABELS[value] }))}
          onToggle={(value) => onToggle("entity_type", value)}
        />
        <FilterGroup
          label="Change kind"
          values={selected.net_change}
          options={(Object.keys(NET_CHANGES) as NetChange[]).map((value) => ({ value, label: NET_CHANGES[value].label }))}
          onToggle={(value) => onToggle("net_change", value)}
        />
      </div>
    </section>
  );
}

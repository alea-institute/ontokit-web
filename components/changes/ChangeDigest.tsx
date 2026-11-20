"use client";

import { Check, Cog, Sparkles, User } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { ChangedEntitiesResponse, ChangeOrigin } from "@/lib/api/changes";
import { cn } from "@/lib/utils";

type ChangedEntity = ChangedEntitiesResponse["items"][number];

const AI_ORIGINS: readonly ChangeOrigin[] = ["ai", "ai_edited"];
const PEOPLE_ORIGINS: readonly ChangeOrigin[] = ["human"];

/**
 * Counts entities, not events. AI origin attaches to a class's creation, so a
 * class a person edits after accepting it counts once as added by AI and once
 * as modified by people. An entity only a sync or import touched counts as system.
 */
export function summarizeChangedEntities(items: readonly ChangedEntity[]) {
  const ai = { added: 0, asSuggested: 0, edited: 0, removedSince: 0 };
  const people = { total: 0, added: 0, modified: 0, removed: 0, transient: 0 };
  let system = 0;

  for (const { origins, net_change } of items) {
    const fromAi = origins.some((origin) => AI_ORIGINS.includes(origin));
    const fromPeople = origins.includes("human");
    if (fromAi) {
      if (net_change === "added" || net_change === "modified") {
        ai.added += 1;
        if (origins.includes("ai_edited")) ai.edited += 1;
        else ai.asSuggested += 1;
      } else {
        ai.removedSince += 1;
      }
    }
    if (fromPeople) {
      people.total += 1;
      // Someone else created it (AI, a sync, or an import): the person's part
      // is the edit or the removal, not the addition.
      const shared = origins.some((origin) => origin !== "human");
      const part = !shared ? net_change : net_change === "added" ? "modified" : net_change === "transient" ? "removed" : net_change;
      people[part] += 1;
    }
    if (!fromAi && !fromPeople) system += 1;
  }

  return { ai, people, system };
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
const sameOrigins = (selected: readonly ChangeOrigin[], tile: readonly ChangeOrigin[]) =>
  selected.length === tile.length && tile.every((origin) => selected.includes(origin));

function Tile({
  icon,
  count,
  label,
  detail,
  tone,
  pressed,
  onClick,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  detail: ReactNode;
  tone: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400",
        pressed
          ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800",
      )}
    >
      <span className="flex items-baseline gap-2">
        <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full", tone)}>{icon}</span>
        <span className="text-3xl font-bold tabular-nums leading-none text-slate-900 dark:text-white">{count}</span>{" "}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      </span>
      <span className="text-sm text-slate-600 dark:text-slate-400"><span className="sr-only">: </span>{detail}<span className="sr-only">. </span></span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-400">
        {pressed && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
        {pressed ? "Showing these below. Select to show all." : "Show these below"}
      </span>
    </button>
  );
}

export function ChangeDigest({
  days,
  items,
  truncated,
  isLoading,
  origins,
  onShow,
}: {
  days: number;
  items?: readonly ChangedEntity[];
  truncated: boolean;
  isLoading: boolean;
  origins: readonly ChangeOrigin[];
  /** Replaces the origin filter; an empty list clears it. */
  onShow: (origins: ChangeOrigin[]) => void;
}) {
  const headingId = useId();
  if (!items && !isLoading) return null;

  const heading = `Last ${days === 1 ? "24 hours" : `${days} days`} at a glance`;
  const { ai, people, system } = summarizeChangedEntities(items ?? []);
  const aiPressed = sameOrigins(origins, AI_ORIGINS);
  const peoplePressed = sameOrigins(origins, PEOPLE_ORIGINS);
  const peopleParts = [
    people.added && `${people.added} added`,
    people.modified && `${people.modified} modified`,
    people.removed && `${people.removed} removed`,
    people.transient && `${people.transient} added then removed`,
  ].filter(Boolean).join(", ");
  const emptyTile = "flex min-w-0 flex-col gap-1 rounded-lg border border-dashed border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900";

  return (
    <section aria-labelledby={headingId} aria-busy={isLoading} className="space-y-2">
      <h2 id={headingId} className="text-sm font-semibold text-slate-900 dark:text-white">{heading}</h2>
      {!items ? (
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((tile) => (
            <div key={tile} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {ai.added > 0 ? (
              <Tile
                icon={<Sparkles aria-hidden="true" className="h-4 w-4" />}
                tone="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                count={ai.added}
                label={`${plural(ai.added, "class", "classes")} added by AI`}
                detail={<>
                  {ai.asSuggested} accepted as suggested, {ai.edited} edited before accepting
                  {ai.removedSince > 0 && <>. {ai.removedSince} more added by AI, then removed</>}
                </>}
                pressed={aiPressed}
                onClick={() => onShow(aiPressed ? [] : [...AI_ORIGINS])}
              />
            ) : (
              <div className={emptyTile}>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Sparkles aria-hidden="true" className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  0 classes added by AI
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {ai.removedSince > 0
                    ? `${ai.removedSince} added by AI, then removed.`
                    : "No AI suggestions were accepted in this window."}
                </p>
              </div>
            )}
            {people.total > 0 ? (
              <Tile
                icon={<User aria-hidden="true" className="h-4 w-4" />}
                tone="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                count={people.total}
                label={`${plural(people.total, "entity", "entities")} changed by people`}
                detail={peopleParts}
                pressed={peoplePressed}
                onClick={() => onShow(peoplePressed ? [] : [...PEOPLE_ORIGINS])}
              />
            ) : (
              <div className={emptyTile}>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <User aria-hidden="true" className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  0 entities changed by people
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">No one edited this branch by hand in this window.</p>
              </div>
            )}
          </div>
          {(system > 0 || truncated) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
              {system > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Cog aria-hidden="true" className="h-3.5 w-3.5" />
                  {system} {plural(system, "entity", "entities")} changed by sync or import.
                </span>
              )}
              {truncated && <span>Counts cover the 5,000 most recently changed entities.</span>}
            </p>
          )}
        </>
      )}
    </section>
  );
}

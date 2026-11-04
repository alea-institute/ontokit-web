/**
 * Single-pane layout logic for the Standard editor/viewer on narrow screens.
 *
 * Below the `md` breakpoint the entity tree and the detail panel cannot sit
 * side by side, so only one of them shows at a time. The switch is CSS-only
 * (`max-md:hidden`): the server and the first client render produce the same
 * markup, so there is no hydration mismatch, and desktop never sees a change.
 *
 * - No selection → the tree.
 * - A selection → the detail panel (the graph lives in the detail pane too).
 * - The visitor tapped "Back" for the current selection → the tree, while the
 *   selection (and its URL param) stays intact. Picking an entity again, or any
 *   navigation that changes the selection, returns to the detail panel.
 */

export type MobilePane = "tree" | "detail";

export interface MobilePaneInput {
  /** IRI selected on the active entity tab, if any. */
  selectedIri: string | null | undefined;
  /** Whether the relationship graph replaces the detail panel. */
  showGraph?: boolean;
  /** Selection key the visitor dismissed with the mobile Back control. */
  dismissedKey?: string | null;
  /** Key for the current selection (see {@link mobileSelectionKey}). */
  selectionKey: string;
}

export function mobileSelectionKey(tab: string, iri: string | null | undefined): string {
  return `${tab}:${iri ?? ""}`;
}

export function resolveMobilePane({
  selectedIri,
  showGraph = false,
  dismissedKey = null,
  selectionKey,
}: MobilePaneInput): MobilePane {
  if (showGraph) return "detail";
  if (!selectedIri) return "tree";
  if (dismissedKey !== null && dismissedKey === selectionKey) return "tree";
  return "detail";
}

/**
 * Class names that hide the inactive pane on narrow screens only. Desktop
 * (`md` and up) always shows both panes.
 */
export function mobilePaneVisibility(pane: MobilePane): { tree: string; detail: string } {
  return {
    tree: pane === "tree" ? "" : "max-md:hidden",
    detail: pane === "detail" ? "" : "max-md:hidden",
  };
}

/** True when the single-pane (below `md`) layout is active. Client-only. */
export function isSinglePaneViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(width < 48rem)").matches;
}

/**
 * History-state key that marks a "detail pane" entry. Opening the details on a
 * phone pushes a same-URL entry carrying this marker, so the browser's (or the
 * device's) Back returns to the tree instead of leaving the viewer. The URL and
 * its `?classIri=` deep link stay untouched.
 */
export const MOBILE_DETAIL_HISTORY_KEY = "__ontokitMobilePane";

export function isMobileDetailEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null
    && (state as Record<string, unknown>)[MOBILE_DETAIL_HISTORY_KEY] === "detail";
}

/**
 * Push a detail-pane entry unless the current entry already is one. Keeps the
 * existing state (the Next.js router stores its own keys there) and the URL.
 * Client-only; returns whether an entry was pushed.
 */
export function pushMobileDetailEntry(): boolean {
  if (typeof window === "undefined") return false;
  const current: unknown = window.history.state;
  if (isMobileDetailEntry(current)) return false;
  const base = typeof current === "object" && current !== null ? current : {};
  window.history.pushState({ ...base, [MOBILE_DETAIL_HISTORY_KEY]: "detail" }, "");
  return true;
}

/**
 * Re-mark the current entry as a detail entry in place. The Next.js router
 * rebuilds `history.state` on `router.replace` (and `history.replaceState`
 * calls go through its patch), dropping the marker; this restores it.
 */
export function markMobileDetailEntry(): void {
  if (typeof window === "undefined") return;
  const current: unknown = window.history.state;
  if (isMobileDetailEntry(current)) return;
  const base = typeof current === "object" && current !== null ? current : {};
  window.history.replaceState({ ...base, [MOBILE_DETAIL_HISTORY_KEY]: "detail" }, "");
}

export const MOBILE_BACK_LABEL: Record<string, string> = {
  classes: "Classes",
  properties: "Properties",
  individuals: "Individuals",
};

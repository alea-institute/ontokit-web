import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  prPartyApi,
  type PRPartyActionKind,
  type PRPartyActionResponse,
  type PRPartyCardDetail,
  type PRPartyCommentResponse,
  type PRPartyMergeMethod,
  type PRPartyQueueCard,
  type PRPartyVerdict,
} from "@/lib/api/prParty";

/**
 * The PR Party queue: one live list plus the actuations that change it.
 *
 * Liveness (KTD19): the app's React Query defaults — 60s stale, no refetch on
 * focus — are wrong for a review queue whose whole value is being current.
 * These keys override with `staleTime: 0`, focus refetch on, and one fixed
 * list-level poll. Foreground only: a background tab polling every 25 seconds
 * burns the reviewer's GitHub rate limit for a screen nobody is looking at.
 *
 * Every key is scoped by user identity. A queue cached under one reviewer must
 * not survive a user switch in the same tab — the cards are per-reviewer, and
 * so are the verdict affordances on them.
 */

/** Fixed foreground poll for the whole queue. No per-card sockets. */
export const PR_PARTY_POLL_INTERVAL_MS = 25_000;

type SessionLike =
  | { user?: { email?: string | null; id?: string | null } | null }
  | null
  | undefined;

/** The identity every PR Party cache key is scoped to. */
export function prPartyUserKey(session: SessionLike): string | null {
  return session?.user?.email ?? session?.user?.id ?? null;
}

/**
 * Query-key factory. Every key nests under `root(userKey)`, so invalidating
 * the root after an actuation refreshes the queue, the open card, and the
 * capability posture in one call.
 */
export const prPartyQueryKeys = {
  root: (userKey: string | null) => ["pr-party", userKey] as const,
  capabilities: (userKey: string | null) => ["pr-party", userKey, "me"] as const,
  queue: (userKey: string | null) => ["pr-party", userKey, "queue"] as const,
  card: (userKey: string | null, cardId: string | null) =>
    ["pr-party", userKey, "card", cardId] as const,
  settings: (userKey: string | null) => ["pr-party", userKey, "settings"] as const,
};

export interface PRPartySubmitActionVars {
  cardId: string;
  actionKind: PRPartyActionKind;
  headSha: string;
  verdict?: PRPartyVerdict;
  body?: string;
  override?: boolean;
  mergeMethod?: PRPartyMergeMethod;
}

export interface PRPartyCardVars {
  cardId: string;
}

export interface PRPartyQuestionVars extends PRPartyCardVars {
  question: string;
}

export interface PRPartyNoteVars extends PRPartyCardVars {
  note: string;
}

interface UsePRPartyQueueOptions {
  /** Off for non-reviewers — the API would 403 and the poll would hammer it. */
  enabled?: boolean;
}

export function usePRPartyQueue(options: UsePRPartyQueueOptions = {}) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userKey = prPartyUserKey(session);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: prPartyQueryKeys.queue(userKey),
    queryFn: () => prPartyApi.getQueue(token!),
    enabled: (options.enabled ?? true) && !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: PR_PARTY_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: prPartyQueryKeys.root(userKey) });
  }, [queryClient, userKey]);

  // Actuations. `retry: false` here stops React Query re-running the whole
  // mutation; `retryOn5xx: false` inside the client stops the retry loop the
  // mutation cannot see. Both are needed — neither alone closes the gap.
  const actionMutation = useMutation<PRPartyActionResponse, Error, PRPartySubmitActionVars>({
    mutationFn: (vars) =>
      prPartyApi.submitAction(
        vars.cardId,
        {
          action_kind: vars.actionKind,
          verdict: vars.verdict,
          body: vars.body,
          head_sha: vars.headSha,
          override: vars.override,
          merge_method: vars.mergeMethod,
        },
        token!,
      ),
    retry: false,
    onSuccess: invalidate,
  });

  const unparkMutation = useMutation<PRPartyCardDetail, Error, PRPartyCardVars>({
    mutationFn: (vars) => prPartyApi.unpark(vars.cardId, token!),
    retry: false,
    onSuccess: invalidate,
  });

  const questionMutation = useMutation<PRPartyCommentResponse, Error, PRPartyQuestionVars>({
    mutationFn: (vars) => prPartyApi.askQuestion(vars.cardId, vars.question, token!),
    retry: false,
    onSuccess: invalidate,
  });

  const noteMutation = useMutation<PRPartyCommentResponse, Error, PRPartyNoteVars>({
    mutationFn: (vars) => prPartyApi.addNote(vars.cardId, vars.note, token!),
    retry: false,
    onSuccess: invalidate,
  });

  const rerunMutation = useMutation<PRPartyCommentResponse, Error, PRPartyCardVars>({
    mutationFn: (vars) => prPartyApi.rerunReview(vars.cardId, token!),
    retry: false,
    onSuccess: invalidate,
  });

  const cards: PRPartyQueueCard[] = query.data?.cards ?? [];

  return {
    cards,
    generatedAt: query.data?.generated_at ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,

    submitAction: actionMutation.mutateAsync,
    isSubmittingAction: actionMutation.isPending,
    actionError: actionMutation.error,

    unparkCard: unparkMutation.mutateAsync,
    isUnparking: unparkMutation.isPending,

    askQuestion: questionMutation.mutateAsync,
    isAskingQuestion: questionMutation.isPending,

    addNote: noteMutation.mutateAsync,
    isAddingNote: noteMutation.isPending,

    rerunReview: rerunMutation.mutateAsync,
    isRerunningReview: rerunMutation.isPending,

    invalidate,
  };
}

/**
 * One card's detail, for the `?card=` panel. Shares the queue's liveness
 * posture so an open card cannot go stale behind the list that spawned it.
 */
export function usePRPartyCard(cardId: string | undefined) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userKey = prPartyUserKey(session);

  const query = useQuery({
    queryKey: prPartyQueryKeys.card(userKey, cardId ?? null),
    queryFn: () => prPartyApi.getCard(cardId!, token!),
    enabled: !!cardId && !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return {
    card: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

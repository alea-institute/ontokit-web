"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, GitPullRequest, Activity, RefreshCw, Lightbulb, Eye, Keyboard, LogIn, Pencil } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { NoOntologyFileEmptyState } from "@/components/projects/NoOntologyFileEmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CommitMessageDialog } from "@/components/editor/CommitMessageDialog";
import { SourceRevisionConflictBanner } from "@/components/editor/SourceRevisionConflictBanner";
import { AddEntityDialog, type NewEntityInfo } from "@/components/editor/AddEntityDialog";
import { useToast } from "@/lib/context/ToastContext";
import { ModeSwitcher } from "@/components/editor/ModeSwitcher";
import { ViewerEditorSwitcher } from "@/components/editor/ViewerEditorSwitcher";
import { readSelectionFromSearchParams } from "@/lib/utils/selectionUrl";
import { DeveloperEditorLayout } from "@/components/editor/developer/DeveloperEditorLayout";
import { StandardEditorLayout } from "@/components/editor/standard/StandardEditorLayout";
import { BranchSelector, RevisionHistoryPanel, HistoryButton } from "@/components/revision";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";
import { useQueryClient } from "@tanstack/react-query";
import { BranchProvider, branchQueryKeys } from "@/lib/context/BranchContext";
import { useProject } from "@/lib/hooks/useProject";
import { useProjectViewer } from "@/lib/hooks/useProjectViewer";
import { useLLMGate } from "@/lib/hooks/useLLMGate";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import { revisionsApi } from "@/lib/api/revisions";
import { projectOntologyApi, type ClassUpdatePayload } from "@/lib/api/client";
import { getLocalName } from "@/lib/utils";
import type { AcceptedSuggestionProvenance } from "@/lib/ontology/suggestionProvenance";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";
import {
  createGeneratedEntityPersistenceQueue,
  GeneratedEntitySaveError,
  persistGeneratedEntity,
  type GeneratedEntityPersistenceMode,
} from "@/lib/editor/generatedEntityPersistence";
import { saveSuggestionUpdate } from "@/lib/editor/suggestionSessionPersistence";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { updatePropertyInTurtle, type TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";
import { updateIndividualInTurtle, type TurtleIndividualUpdateData } from "@/lib/ontology/turtleIndividualUpdater";
import {
  detectPatternFromIriIndex,
  type EntityType,
  type IriSuffixPattern,
} from "@/lib/ontology/iriGeneration";
import { commonPrefixes } from "@/lib/editor/languages/turtle";

import { useKeyboardShortcuts, type ShortcutDefinition } from "@/lib/hooks/useKeyboardShortcuts";
import { KeyboardShortcutDialog } from "@/components/editor/KeyboardShortcutDialog";
import { SuggestionSubmitDialog } from "@/components/editor/SuggestionSubmitDialog";
import { useSuggestionSession } from "@/lib/hooks/useSuggestionSession";
import { useSuggestionBeacon } from "@/lib/hooks/useSuggestionBeacon";
import { DeleteImpactAnalysis } from "@/components/editor/DeleteImpactAnalysis";
import { RemoteSyncIndicator } from "@/components/editor/RemoteSyncIndicator";
import { ShareButton } from "@/components/editor/ShareButton";
import { useAnonymousSuggestion } from "@/lib/hooks/useAnonymousSuggestion";
import { CreditModal } from "@/components/suggestions/CreditModal";
import { ProposalSubmittedDialog } from "@/components/editor/ProposalSubmittedDialog";
import { useTrustCapabilities } from "@/lib/hooks/useTrustCapabilities";
import { isClientAuthDisabled, shouldShowAuthUI } from "@/lib/auth-mode";
import type { TrustGate } from "@/components/editor/TrustExplainer";

import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import {
  SourceRevisionConflictError,
  useSourceRevisionGuard,
} from "@/lib/hooks/useSourceRevisionGuard";

/**
 * True when a suggestion card (role="listitem") currently owns focus. Used to
 * gate the bare-key suggestion shortcuts so they only fire — and only consume
 * the event — when the user is actually reviewing a suggestion (H-1).
 */
function suggestionCardHasFocus(): boolean {
  return !!document.activeElement?.closest('[role="listitem"]');
}

export default function EditorPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = params.id as string;
  const { isRetiredRedirecting } = useProject(projectId, session?.accessToken);
  const resumeSessionParam = searchParams.get("resumeSession") || undefined;
  const resumeBranchParam = searchParams.get("branch") || undefined;
  // Memoize the parsed URL selection so its identity is stable across renders
  // when the URL hasn't changed — otherwise the URL-restore effect would re-fire
  // every render and risk clobbering the user's in-page selection.
  const searchParamsString = searchParams.toString();
  const initialSelection = useMemo(
    () => readSelectionFromSearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );
  // Tracks the URL selection we've already applied. Each unique
  // `${type}:${iri}` is consumed at most once per page-instance — if the URL
  // changes mid-session, we apply the new key, but we never re-apply a key.
  const consumedSelectionRef = useRef<string | null>(null);
  const initialBranch = resumeBranchParam
    || (() => { try { return sessionStorage.getItem(`ontokit:branch:${projectId}`); } catch { return null; } })()
    || undefined;

  const editorMode = useEditorModeStore((s) => s.editorMode);

  // Mark this surface as the user's most recent project view so side-page
  // Back-to-project links route them back to the editor — regardless of
  // whether their global preferEditMode preference says viewer or editor.
  const setProjectViewMode = useSelectionStore((s) => s.setMode);
  useEffect(() => {
    setProjectViewMode("editor");
  }, [setProjectViewMode]);

  // Auth mode — set at build time by next.config.ts
  // Sign-in affordances need an identity provider that can actually complete
  // sign-in. This is the same client predicate the header uses, so disabled mode
  // with stale provider flags never offers sign-in.
  const showAuthUI = shouldShowAuthUI();
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE || "required";
  // Auth-disabled mode never has a token: the API accepts writes as its
  // anonymous identity and returns that identity's role, which the redirect
  // and write paths below trust. Required and optional keep every token guard.
  const writesWithoutToken = isClientAuthDisabled();

  // Branch state
  const queryClient = useQueryClient();
  const [activeBranch, setActiveBranch] = useState<string | undefined>(undefined);
  const generatedEntityPersistenceQueue = useRef(createGeneratedEntityPersistenceQueue());

  // Shared project/tree/source state from hook
  const viewer = useProjectViewer({
    projectId,
    accessToken: session?.accessToken,
    sessionStatus: status,
    activeBranch,
    enableWebSocket: true,
  });

  const {
    project, isLoading, error, errorKind,
    openPRCount, pendingSuggestionCount, lintSummary, normalizationStatus,
    canManage, canEdit, canSuggest, isSuggestionMode,
    hasValidAccess, hasOntology,
    nodes, totalClasses, isTreeLoading, treeError,
    selectedIri, loadRootClasses, expandNode, collapseNode, selectNode,
    navigateToNode, addOptimisticNode, removeOptimisticNode, updateNodeLabel,
    collapseAll, collapseOneLevel, expandOneLevel, expandAllFully,
    hasExpandableNodes, hasExpandedNodes, isExpandingAll,
    reparentOptimistic, rollbackReparent,
    selectedNodeFallback,
    sourceContent, setSourceContent, sourceRevision, setSourceSnapshot,
    isLoadingSource, sourceError, isPreloading,
    loadSourceContent, reloadSourceContent, sourceIriIndex, setSourceIriIndex,
    connectionStatus, wsEndpoint, wsPurpose,
    resetSourceState,
  } = viewer;

  // Single write guard for this page, mirroring canWrite in BranchContext: a
  // token authorizes writes. Auth-disabled mode never has one, so there the
  // anonymous identity's edit-capable role is the credential — a visitor on a
  // public project it cannot edit may only propose, never commit.
  const canWrite = !!session?.accessToken || (writesWithoutToken && !!canEdit);

  // LLM access gate — shared (React Query dedupes) with the layouts. Used here
  // to scope the suggestion keyboard shortcuts so they only register when the
  // project actually has LLM access (H-1).
  const llmGate = useLLMGate(projectId, project?.user_role);
  const canUseLLM = llmGate.canUseLLM;

  // Trust ladder (R8, KTD3) — the single client-side source of tier truth.
  // Minting stays locked while capabilities are loading and when the fetch
  // failed: an affordance that appears before its permission is known invites
  // a contributor into an action the server will refuse.
  const {
    tier: trustTier,
    canMintEntities,
    isLoading: isTrustLoading,
    isError: isTrustError,
    promotionProgress,
    refetch: refetchTrust,
  } = useTrustCapabilities(projectId);

  const trustGate: TrustGate = useMemo(
    () => ({
      tier: trustTier,
      locked: !canMintEntities,
      isLoading: isTrustLoading,
      isError: isTrustError,
      onRetry: () => { void refetchTrust(); },
      progress: promotionProgress,
      onSignIn:
        trustTier === "anonymous" && showAuthUI
          ? () => signIn("zitadel", { callbackUrl: window.location.href })
          : undefined,
    }),
    [
      trustTier,
      canMintEntities,
      isTrustLoading,
      isTrustError,
      promotionProgress,
      refetchTrust,
      showAuthUI,
    ],
  );

  // UI state (editor-only)
  const [showHistory, setShowHistory] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const sourceEditorRef = useRef<OntologySourceEditorRef>(null);
  const entityNavigationRef = useRef<((iri: string, type?: string) => void) | null>(null);

  // Restore selected entity from URL query param. For classes we wait for the
  // class tree to load; for properties and individuals we dispatch through the
  // layout's nav handler (entityNavigationRef), which switches the active tab
  // and selects the entity directly. Each URL-derived selection is applied at
  // most once via consumedSelectionRef — that way an in-page selection change
  // (which doesn't update the URL) isn't undone on the next render.
  useEffect(() => {
    if (!initialSelection || !activeBranch) return;
    const key = `${initialSelection.type}:${initialSelection.iri}`;
    if (consumedSelectionRef.current === key) return;

    if (initialSelection.type === "class") {
      if (isTreeLoading || !nodes.length) return;
      if (selectedIri === initialSelection.iri) {
        consumedSelectionRef.current = key;
        return;
      }
      // Await the navigation so we only mark this URL key consumed when the
      // tree-side restore actually succeeds. If it throws, leave the key
      // unconsumed so a later render (e.g. once data is healthy) can retry.
      let cancelled = false;
      navigateToNode(initialSelection.iri)
        .then(() => {
          if (!cancelled) consumedSelectionRef.current = key;
        })
        .catch((err) => {
          if (!cancelled) console.error("Failed to restore selection from URL:", err);
        });
      return () => {
        cancelled = true;
      };
    }
    if (isLoading) return; // layout not yet mounted
    if (!entityNavigationRef.current) return; // layout's ref not yet populated
    entityNavigationRef.current(initialSelection.iri, initialSelection.type);
    consumedSelectionRef.current = key;
  }, [initialSelection, activeBranch, isTreeLoading, nodes.length, selectedIri, navigateToNode, isLoading]);

  // Track accepted suggestion IRIs for sparkle badges (D-07)
  const [acceptedSuggestionIris, setAcceptedSuggestionIris] = useState<Set<string>>(new Set());

  // Commit dialog
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [pendingSaveContent, setPendingSaveContent] = useState<string | null>(null);

  // Add entity dialog
  const [addEntityDialogOpen, setAddEntityDialogOpen] = useState(false);
  const [addEntityParentIri, setAddEntityParentIri] = useState<string | undefined>(undefined);
  const [addEntityParentLabel, setAddEntityParentLabel] = useState<string | undefined>(undefined);

  // IRI pattern detection
  const [iriPattern, setIriPattern] = useState<IriSuffixPattern>("uuid");
  const [nextNumeric, setNextNumeric] = useState<number | undefined>(undefined);
  const [ontologyNamespace, setOntologyNamespace] = useState("http://example.org/ont#");
  const [ontologyPrefix, setOntologyPrefix] = useState<string | undefined>(undefined);
  const iriPatternDetectedRef = useRef(false);

  // Detail panel refresh key (bumped after class update)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  // Delete class state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIri, setDeleteTargetIri] = useState<string | null>(null);
  const [deleteTargetLabel, setDeleteTargetLabel] = useState<string>("");
  const [deleteImpactAcknowledged, setDeleteImpactAcknowledged] = useState(true);

  // Toast
  const toast = useToast();

  // Pending scroll IRI for source navigation
  const [pendingScrollIri, setPendingScrollIri] = useState<string | null>(null);

  const handleLoadLatestSource = useCallback((content: string) => {
    sourceEditorRef.current?.replaceValue(content);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    setDetailRefreshKey((key) => key + 1);
  }, [setSourceIriIndex]);

  const {
    conflict: sourceRevisionConflict,
    isLoadingLatest,
    saveSource: saveDirectSource,
    loadLatest,
    captureConflict: captureSourceConflict,
  } = useSourceRevisionGuard({
    projectId,
    accessToken: session?.accessToken,
    activeBranch,
    sourceRevision,
    setSourceSnapshot,
    reloadSourceContent,
    onLoadLatest: handleLoadLatestSource,
  });
  const sourceRevisionConflictRef = useRef(sourceRevisionConflict);
  useEffect(() => {
    sourceRevisionConflictRef.current = sourceRevisionConflict;
  }, [sourceRevisionConflict]);

  const handleLoadLatest = useCallback(async () => {
    await loadLatest();
    toast.success("Latest source loaded", "The stale draft was discarded after your confirmation.");
  }, [loadLatest, toast]);

  // Keyboard shortcut help dialog
  const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);

  // Suggestion session (only active for suggesters who can't directly edit)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Anonymous proposal mode: available when AUTH_MODE != required, the user is
  // NOT signed in as editor/suggester, and the project is PUBLIC (the api only
  // allows anonymous sessions on public projects — hiding the affordance on
  // private projects avoids a guaranteed 403 loop). Evaluated after the
  // isLoading early-return, so project is resolved wherever this gates.
  const canPropose = authMode !== "required" && !canEdit && !canSuggest && !!project?.is_public;
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [discardProposalConfirmOpen, setDiscardProposalConfirmOpen] = useState(false);

  // Post-submit success state for anonymous proposals (R7, KTD12). A dialog
  // rather than a toast, because this is the one moment the account nudge has
  // the contributor's attention — and a toast that vanishes cannot carry a CTA.
  const [submittedProposal, setSubmittedProposal] = useState<
    { prNumber: number; prUrl: string | null } | null
  >(null);

  const anonymousSuggestion = useAnonymousSuggestion({
    projectId,
    onSubmitted: (prNumber, prUrl) => {
      setSubmittedProposal({ prNumber, prUrl });
    },
    onError: (msg) => toast.error("Proposal error", msg),
  });

  const isAnonymousProposalMode = canPropose && anonymousSuggestion.isActive;

  const suggestionSession = useSuggestionSession({
    projectId,
    viewerId: session?.user?.id,
    accessToken: session?.accessToken,
    resumeSessionId: isSuggestionMode ? resumeSessionParam : undefined,
    resumeBranch: isSuggestionMode ? resumeBranchParam : undefined,
    onSubmitted: (prNumber) => {
      toast.success(`Suggestions submitted as PR #${prNumber}`);
    },
    onError: (msg) => toast.error("Suggestion error", msg),
  });

  // Beacon safety net for browser close
  useSuggestionBeacon({
    projectId,
    sessionId: suggestionSession.sessionId,
    beaconToken: suggestionSession.beaconToken,
    getCurrentContent: () => sourceContent || null,
    enabled: isSuggestionMode && suggestionSession.isActive,
  });

  // Save refs for commit promise
  const pendingSaveResolveRef = useRef<(() => void) | null>(null);
  const pendingSaveRejectRef = useRef<((error: Error) => void) | null>(null);

  const handleSaveSource = useCallback(async (newContent: string) => {
    if (!projectId || !canWrite) {
      throw new Error("Not authenticated");
    }
    setPendingSaveContent(newContent);
    setCommitDialogOpen(true);
    return new Promise<void>((resolve, reject) => {
      pendingSaveResolveRef.current = resolve;
      pendingSaveRejectRef.current = reject;
    });
  }, [projectId, canWrite]);

  const handleCommitConfirm = useCallback(async (commitMessage: string) => {
    if (!projectId || !canWrite || !pendingSaveContent) {
      throw new Error("Not authenticated or no content to save");
    }

    try {
      await saveDirectSource(pendingSaveContent, commitMessage);
    } catch (error) {
      if (error instanceof SourceRevisionConflictError) {
        // A stale raw save is terminal for this commit attempt. Reject the
        // source editor's pending promise so its draft stays editable, close
        // the dialog, and require the explicit reconcile action.
        pendingSaveRejectRef.current?.(error);
        pendingSaveResolveRef.current = null;
        pendingSaveRejectRef.current = null;
        setPendingSaveContent(null);
        setCommitDialogOpen(false);
      }
      throw error;
    }
    setSourceIriIndex(new Map());
    loadRootClasses();
    iriPatternDetectedRef.current = false;
    queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId, session?.accessToken) });

    pendingSaveResolveRef.current?.();
    pendingSaveResolveRef.current = null;
    pendingSaveRejectRef.current = null;
    setPendingSaveContent(null);
  }, [projectId, session, canWrite, pendingSaveContent, loadRootClasses, queryClient, setSourceIriIndex, saveDirectSource]);

  const handleCommitDialogClose = useCallback((open: boolean) => {
    setCommitDialogOpen(open);
    if (!open && pendingSaveContent) {
      pendingSaveRejectRef.current?.(new Error("Save cancelled"));
      pendingSaveResolveRef.current = null;
      pendingSaveRejectRef.current = null;
      setPendingSaveContent(null);
    }
  }, [pendingSaveContent]);

  // Detect IRI pattern
  useEffect(() => {
    if (iriPatternDetectedRef.current || sourceIriIndex.size === 0 || !sourceContent) return;
    iriPatternDetectedRef.current = true;

    const internalNamespaces = new Set<string>();
    const prefixMap = new Map<string, string>();
    const externalNamespaces = new Set(commonPrefixes.map((p) => p.namespace));

    for (const line of sourceContent.split("\n")) {
      const baseMatch = line.match(/@base\s+<([^>]+)>/i);
      if (baseMatch) {
        internalNamespaces.add(baseMatch[1]);
      }
      const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
      if (prefixMatch) {
        const [, pfx, ns] = prefixMatch;
        prefixMap.set(pfx, ns);
        if (!externalNamespaces.has(ns)) {
          internalNamespaces.add(ns);
        }
      }
    }

    const defaultNs = prefixMap.get("") ?? [...internalNamespaces][0];
    if (defaultNs) {
      setOntologyNamespace(defaultNs);
    }

    for (const [pfx, ns] of prefixMap) {
      if (ns === defaultNs && pfx !== "") {
        setOntologyPrefix(pfx);
        break;
      }
    }

    const result = detectPatternFromIriIndex(sourceIriIndex, internalNamespaces);
    setIriPattern(result.pattern);
    if (result.nextNumeric !== undefined) {
      setNextNumeric(result.nextNumeric);
    }
  }, [sourceIriIndex, sourceContent]);

  // Handle "Add Entity"
  const handleAddEntity = useCallback((parentIri?: string) => {
    setAddEntityParentIri(parentIri);
    if (parentIri) {
      const findLabel = (items: typeof nodes): string | undefined => {
        for (const node of items) {
          if (node.iri === parentIri) return node.label;
          const found = findLabel(node.children);
          if (found) return found;
        }
        return undefined;
      };
      setAddEntityParentLabel(findLabel(nodes));
    } else {
      setAddEntityParentLabel(undefined);
    }
    setAddEntityDialogOpen(true);
  }, [nodes]);

  const handleEntityConfirm = useCallback(
    async (entity: NewEntityInfo) => {
      if (!canSuggest) return;
      // Trust gate (R8): the dialog already disables Create, but the confirm
      // path is the one the server would refuse, so it carries the guard too.
      if (trustGate.locked) return;
      const snippet = generateTurtleSnippet({
        iri: entity.iri,
        label: entity.label,
        entityType: entity.entityType,
        parentIri: entity.parentIri,
        ontologyPrefix,
        ontologyNamespace,
      });

      if (sourceEditorRef.current) {
        sourceEditorRef.current.insertAtEnd(snippet);
        setSourceContent(sourceEditorRef.current.getValue());
      } else if (sourceContent) {
        setSourceContent((prev) => prev + snippet);
      } else {
        // Source not yet loaded — fetch it first to avoid overwriting with just the snippet
        if (!projectId || !canWrite || !activeBranch) return;
        try {
          const response = await revisionsApi.getFileAtVersion(
            projectId,
            activeBranch,
            session?.accessToken,
            project?.git_ontology_path
          );
          setSourceSnapshot(response.content + snippet, response.revision);
        } catch {
          toast.error("Failed to load source before adding entity");
          return;
        }
      }

      if (entity.entityType === "class") {
        addOptimisticNode(entity.iri, entity.label, entity.parentIri);
      }
    },
    [canSuggest, trustGate.locked, ontologyPrefix, ontologyNamespace, addOptimisticNode, sourceContent, projectId, session, canWrite, activeBranch, project, toast, setSourceContent, setSourceSnapshot],
  );

  const generatedEntityAccessToken = session?.accessToken;
  const persistAcceptedGeneratedEntity = useCallback(async (
    entity: {
      iri: string;
      label: string;
      parentIri: string;
      entityType: EntityType;
      provenance?: AcceptedSuggestionProvenance;
    },
  ) => {
    const mode: GeneratedEntityPersistenceMode = isAnonymousProposalMode
      ? "anonymous-suggestion"
      : isSuggestionMode
        ? "authenticated-suggestion"
        : "direct";
    if (mode === "direct" && !canWrite) throw new Error("Not authenticated");
    if (mode === "direct" && sourceRevisionConflictRef.current) {
      throw new SourceRevisionConflictError(sourceRevisionConflictRef.current);
    }
    const persistenceScope = `${projectId}:${mode}:${activeBranch ?? "pending"}`;
    let result;
    try {
      result = await generatedEntityPersistenceQueue.current.run(
        persistenceScope,
        () => {
          if (mode === "direct" && sourceRevisionConflictRef.current) {
            throw new SourceRevisionConflictError(sourceRevisionConflictRef.current);
          }
          return persistGeneratedEntity({
            mode,
            projectId,
            branch: activeBranch,
            accessToken: generatedEntityAccessToken,
            ontologyPath: project?.git_ontology_path,
            entity,
            ontologyPrefix,
            ontologyNamespace,
            suggestionSession: {
              startSession: suggestionSession.startSession,
              saveToSession: suggestionSession.saveToSession,
            },
            anonymousSession: {
              startSession: anonymousSuggestion.startSession,
              saveToSession: anonymousSuggestion.saveToSession,
            },
          });
        },
      );
    } catch (error) {
      if (mode === "direct" && error instanceof GeneratedEntitySaveError) {
        const conflictError = captureSourceConflict(error.cause, error.draftContent);
        if (conflictError instanceof SourceRevisionConflictError) {
          sourceRevisionConflictRef.current = conflictError.conflict;
        }
        throw conflictError ?? error;
      }
      throw error;
    }

    // Only update client state after the authoritative branch confirms the
    // entity. A rejected save leaves the card pending and these values intact.
    if (mode === "direct" && result.revision) {
      setSourceSnapshot(result.content, result.revision);
    } else {
      setSourceContent(result.content);
    }
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    setDetailRefreshKey((key) => key + 1);
    if (mode === "direct") {
      queryClient.invalidateQueries({
        queryKey: branchQueryKeys.list(projectId, generatedEntityAccessToken),
      });
    }
  }, [
    isAnonymousProposalMode,
    isSuggestionMode,
    canWrite,
    projectId,
    activeBranch,
    generatedEntityAccessToken,
    project?.git_ontology_path,
    ontologyPrefix,
    ontologyNamespace,
    suggestionSession.startSession,
    suggestionSession.saveToSession,
    anonymousSuggestion.startSession,
    anonymousSuggestion.saveToSession,
    setSourceContent,
    setSourceSnapshot,
    setSourceIriIndex,
    queryClient,
    captureSourceConflict,
  ]);

  const getDirectSourceSnapshot = useCallback(async () => {
    if (sourceRevision) {
      return { content: sourceContent, revision: sourceRevision };
    }
    if (!activeBranch) throw new Error("No branch selected");

    const response = await revisionsApi.getFileAtVersion(
      projectId,
      activeBranch,
      session?.accessToken,
      project?.git_ontology_path,
    );
    setSourceSnapshot(response.content, response.revision);
    return { content: response.content, revision: response.revision };
  }, [activeBranch, project?.git_ontology_path, projectId, session?.accessToken, setSourceSnapshot, sourceContent, sourceRevision]);

  const refreshAfterDirectEntitySave = useCallback(() => {
    setDetailRefreshKey((key) => key + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    void queryClient.invalidateQueries({
      queryKey: branchQueryKeys.list(projectId, session?.accessToken),
    });
  }, [projectId, queryClient, session?.accessToken, setSourceIriIndex]);

  // Handle accepted child suggestion — persist first, then update the tree (D-07)
  const handleAddSuggestedChild = useCallback(async (
    iri: string,
    label: string,
    parentIri: string,
    provenance?: AcceptedSuggestionProvenance,
  ) => {
    // The persistence helper spreads the entity into the snippet after reading
    // authoritative source. Let the snippet bind PROV-O at the appended block.
    await persistAcceptedGeneratedEntity({ iri, label, parentIri, entityType: "class", provenance });
    addOptimisticNode(iri, label, parentIri);
    setAcceptedSuggestionIris((prev) => new Set(prev).add(iri));
  }, [persistAcceptedGeneratedEntity, addOptimisticNode]);

  // Handle accepted sub-PROPERTY suggestion (B-1). Distinct from
  // handleAddSuggestedChild (classes): emits the correct OWL property rdf:type
  // and does NOT push a node into the class tree — properties live in the
  // property tree, which re-derives from the ontology source.
  const handleAddSuggestedProperty = useCallback((
    iri: string,
    label: string,
    parentIri: string,
    propertyType: "object" | "data" | "annotation" = "object",
    provenance?: AcceptedSuggestionProvenance,
  ) => {
    const entityType =
      propertyType === "data"
        ? "dataProperty"
        : propertyType === "annotation"
          ? "annotationProperty"
          : "objectProperty";

    return persistAcceptedGeneratedEntity({ iri, label, parentIri, entityType, provenance })
      .then(() => {
        setAcceptedSuggestionIris((prev) => new Set(prev).add(iri));
      });
  }, [persistAcceptedGeneratedEntity]);

  // Handle copy IRI
  const handleCopyIri = useCallback(async (iri: string) => {
    try {
      await navigator.clipboard.writeText(iri);
      toast.success("IRI copied to clipboard");
    } catch {
      toast.error("Failed to copy IRI");
    }
  }, [toast]);

  // Handle delete class
  const handleDeleteClass = useCallback((iri: string, label: string) => {
    setDeleteTargetIri(iri);
    setDeleteTargetLabel(label);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetIri || !canWrite) return;

    // Optimistic removal
    removeOptimisticNode(deleteTargetIri);

    try {
      await projectOntologyApi.deleteClass(
        projectId,
        deleteTargetIri,
        `Delete class ${deleteTargetLabel}`,
        session?.accessToken,
        activeBranch
      );
      toast.success(`Deleted "${deleteTargetLabel}"`);
      // Invalidate the paired source snapshot and its scope so the next form
      // edit must re-fetch content and revision from the authoritative branch.
      resetSourceState();
      // Reload tree to ensure consistency
      loadRootClasses();
      queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId, session?.accessToken) });
    } catch (err) {
      toast.error(
        "Failed to delete class",
        err instanceof Error ? err.message : "Unknown error"
      );
      // Reload tree to restore state
      loadRootClasses();
    }
  }, [deleteTargetIri, deleteTargetLabel, session, canWrite, projectId, activeBranch, removeOptimisticNode, toast, loadRootClasses, queryClient, resetSourceState]);

  // Handle update class (form-based editing)
  // Routes through source save: modifies the Turtle text and commits via PUT /source
  const handleUpdateClass = useCallback(async (classIri: string, data: ClassUpdatePayload) => {
    if (!canWrite) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    const snapshot = await getDirectSourceSnapshot();

    // Apply the update to the Turtle source text
    const modifiedSource = updateClassInTurtle(snapshot.content, classIri, data);

    // Save via the source endpoint (the only project-level write path)
    const label = data.labels[0]?.value || getLocalName(classIri);
    const commitMessage = `Update class ${label}`;

    await saveDirectSource(modifiedSource, commitMessage, snapshot.revision);
    toast.success(`Updated "${label}"`);

    // Update the tree node label in-place (preserves expansion state)
    updateNodeLabel(classIri, label);
    refreshAfterDirectEntitySave();
  }, [session, canWrite, activeBranch, toast, updateNodeLabel, getDirectSourceSnapshot, saveDirectSource, refreshAfterDirectEntitySave]);

  // Handle update property (form-based editing)
  const handleUpdateProperty = useCallback(async (propertyIri: string, data: TurtlePropertyUpdateData) => {
    if (!canWrite) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    const snapshot = await getDirectSourceSnapshot();

    const modifiedSource = updatePropertyInTurtle(snapshot.content, propertyIri, data);
    const label = data.labels[0]?.value || getLocalName(propertyIri);
    const commitMessage = `Update property ${label}`;

    await saveDirectSource(modifiedSource, commitMessage, snapshot.revision);
    toast.success(`Updated "${label}"`);
    refreshAfterDirectEntitySave();
  }, [session, canWrite, activeBranch, toast, getDirectSourceSnapshot, saveDirectSource, refreshAfterDirectEntitySave]);

  // Handle update individual (form-based editing)
  const handleUpdateIndividual = useCallback(async (individualIri: string, data: TurtleIndividualUpdateData) => {
    if (!canWrite) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    const snapshot = await getDirectSourceSnapshot();

    const modifiedSource = updateIndividualInTurtle(snapshot.content, individualIri, data);
    const label = data.labels[0]?.value || getLocalName(individualIri);
    const commitMessage = `Update individual ${label}`;

    await saveDirectSource(modifiedSource, commitMessage, snapshot.revision);
    toast.success(`Updated "${label}"`);
    refreshAfterDirectEntitySave();
  }, [session, canWrite, activeBranch, toast, getDirectSourceSnapshot, saveDirectSource, refreshAfterDirectEntitySave]);

  // Handle suggestion-mode class update
  // Instead of directly committing, sends modified source to the suggestion branch
  const handleSuggestClassUpdate = useCallback(async (classIri: string, data: ClassUpdatePayload) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updateClassInTurtle(source, classIri, data);
    const label = data.labels[0]?.value || getLocalName(classIri);

    await saveSuggestionUpdate({
      isSessionActive: Boolean(suggestionSession.sessionId),
      session: suggestionSession,
      content: modifiedSource,
      entityIri: classIri,
      entityLabel: label,
      onSaved: () => {
        setSourceContent(modifiedSource);
        toast.success(`Suggested update to "${label}"`);
        updateNodeLabel(classIri, label);
        setDetailRefreshKey((k) => k + 1);
        setSourceIriIndex(new Map());
        iriPatternDetectedRef.current = false;
      },
    });
  }, [session, projectId, activeBranch, project, sourceContent, toast, updateNodeLabel, suggestionSession, setSourceContent, setSourceIriIndex]);

  // Handle suggestion-mode property update
  const handleSuggestPropertyUpdate = useCallback(async (propertyIri: string, data: TurtlePropertyUpdateData) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId, activeBranch, session.accessToken, project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updatePropertyInTurtle(source, propertyIri, data);
    const label = data.labels[0]?.value || getLocalName(propertyIri);

    await saveSuggestionUpdate({
      isSessionActive: Boolean(suggestionSession.sessionId),
      session: suggestionSession,
      content: modifiedSource,
      entityIri: propertyIri,
      entityLabel: label,
      onSaved: () => {
        setSourceContent(modifiedSource);
        toast.success(`Suggested update to "${label}"`);
        setDetailRefreshKey((k) => k + 1);
        setSourceIriIndex(new Map());
        iriPatternDetectedRef.current = false;
      },
    });
  }, [session, projectId, activeBranch, project, sourceContent, toast, suggestionSession, setSourceContent, setSourceIriIndex]);

  // Handle suggestion-mode individual update
  const handleSuggestIndividualUpdate = useCallback(async (individualIri: string, data: TurtleIndividualUpdateData) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId, activeBranch, session.accessToken, project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updateIndividualInTurtle(source, individualIri, data);
    const label = data.labels[0]?.value || getLocalName(individualIri);

    await saveSuggestionUpdate({
      isSessionActive: Boolean(suggestionSession.sessionId),
      session: suggestionSession,
      content: modifiedSource,
      entityIri: individualIri,
      entityLabel: label,
      onSaved: () => {
        setSourceContent(modifiedSource);
        toast.success(`Suggested update to "${label}"`);
        setDetailRefreshKey((k) => k + 1);
        setSourceIriIndex(new Map());
        iriPatternDetectedRef.current = false;
      },
    });
  }, [session, projectId, activeBranch, project, sourceContent, toast, suggestionSession, setSourceContent, setSourceIriIndex]);

  // Anonymous proposal saves route through anonymousSuggestion.saveToSession()
  // instead of any commit path. Every entity kind shares this helper so no
  // form edit made while proposing can reach a direct base-branch write.
  const saveAnonymousProposal = useCallback(async (
    entityIri: string,
    label: string,
    modify: (source: string) => string,
    options: { updateTreeLabel?: boolean } = {},
  ) => {
    if (!activeBranch && !anonymousSuggestion.branch) {
      throw new Error("No branch selected");
    }

    // Ensure session exists before saving
    if (!anonymousSuggestion.sessionId) {
      await anonymousSuggestion.startSession();
    }

    // Load source from the anonymous suggestion branch (or current active branch as fallback)
    const branchToLoad = anonymousSuggestion.branch || activeBranch;
    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        branchToLoad!,
        undefined, // no Bearer token needed for anonymous
        project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = modify(source);

    const saved = await anonymousSuggestion.saveToSession(modifiedSource, entityIri, label);
    if (!saved) {
      // A concurrent save was in flight (or the save failed — errors already
      // toast via onError). Do NOT report success or update local state for a
      // change that never reached the session branch.
      toast.error("Change not saved", "A previous save was still in progress or the save failed — please retry.");
      return;
    }

    setSourceContent(modifiedSource);
    toast.success(`Proposed update to "${label}"`);
    if (options.updateTreeLabel) updateNodeLabel(entityIri, label);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
  }, [activeBranch, anonymousSuggestion, projectId, project?.git_ontology_path, sourceContent, toast, updateNodeLabel, setSourceContent, setSourceIriIndex]);

  const handleAnonymousClassUpdate = useCallback(
    (classIri: string, data: ClassUpdatePayload) =>
      saveAnonymousProposal(
        classIri,
        data.labels[0]?.value || getLocalName(classIri),
        (source) => updateClassInTurtle(source, classIri, data),
        { updateTreeLabel: true },
      ),
    [saveAnonymousProposal],
  );

  const handleAnonymousPropertyUpdate = useCallback(
    (propertyIri: string, data: TurtlePropertyUpdateData) =>
      saveAnonymousProposal(
        propertyIri,
        data.labels[0]?.value || getLocalName(propertyIri),
        (source) => updatePropertyInTurtle(source, propertyIri, data),
      ),
    [saveAnonymousProposal],
  );

  const handleAnonymousIndividualUpdate = useCallback(
    (individualIri: string, data: TurtleIndividualUpdateData) =>
      saveAnonymousProposal(
        individualIri,
        data.labels[0]?.value || getLocalName(individualIri),
        (source) => updateIndividualInTurtle(source, individualIri, data),
      ),
    [saveAnonymousProposal],
  );

  // Handle anonymous proposal "Propose Edit" button click
  const handleProposeEdit = useCallback(async () => {
    if (!anonymousSuggestion.isActive) {
      await anonymousSuggestion.startSession();
    }
    // After session starts, isAnonymousProposalMode becomes true (canPropose && isActive),
    // which re-renders ClassDetailPanel with canEdit=true allowing form editing
  }, [anonymousSuggestion]);

  // Handle "Submit Proposal" — called by CreditModal for EVERY exit path
  // (save / skip / dismiss). The honeypot value is forwarded verbatim so the
  // server-side control (filled honeypot -> silent fake success) actually
  // receives the bot signal (PR-7 /ce:review BLOCKER fix).
  const handleAnonymousSubmit = useCallback(async (
    name: string | null,
    email: string | null,
    website: string = "",
  ) => {
    setCreditModalOpen(false);
    await anonymousSuggestion.submitSession(undefined, name ?? undefined, email ?? undefined, website);
  }, [anonymousSuggestion]);

  // Handle drag-and-drop reparent class
  // Fetches full class detail, modifies parent_iris, then routes through the appropriate save handler
  const handleReparentClass = useCallback(async (
    classIri: string,
    _oldParentIris: string[],
    newParentIris: string[],
    mode: "move" | "add",
  ) => {
    if (!isAnonymousProposalMode && !isSuggestionMode && !canWrite) throw new Error("Not authenticated");
    if (isSuggestionMode && !session?.accessToken) throw new Error("Not authenticated");

    // Fetch the full class detail to get authoritative parent_iris
    const detail = await projectOntologyApi.getClassDetail(projectId, classIri, session?.accessToken, activeBranch);

    // Build new parent list based on mode
    let updatedParentIris: string[];
    if (newParentIris.length === 0) {
      // Dropped on root zone — remove all parents
      updatedParentIris = [];
    } else if (mode === "add") {
      // Add mode — keep existing, add new (deduplicated)
      const parentSet = new Set(detail.parent_iris);
      for (const iri of newParentIris) parentSet.add(iri);
      updatedParentIris = [...parentSet];
    } else {
      // Move mode — replace old tree parent with new
      const oldTreeParent = _oldParentIris[0] || null;
      if (oldTreeParent && detail.parent_iris.includes(oldTreeParent)) {
        updatedParentIris = detail.parent_iris.map((p) =>
          p === oldTreeParent ? newParentIris[0] : p,
        );
      } else {
        // Old parent not in actual parents (e.g., node was at root) — just add new
        updatedParentIris = [...detail.parent_iris, ...newParentIris];
      }
      // Deduplicate
      updatedParentIris = [...new Set(updatedParentIris)];
    }

    // Build ClassUpdatePayload from the fetched detail
    const payload: ClassUpdatePayload = {
      labels: detail.labels,
      comments: detail.comments,
      parent_iris: updatedParentIris,
      annotations: detail.annotations.map((a) => ({
        property_iri: a.property_iri,
        values: a.values,
      })),
      deprecated: detail.deprecated,
      equivalent_iris: detail.equivalent_iris ?? undefined,
      disjoint_iris: detail.disjoint_iris ?? undefined,
    };

    // Route through the appropriate save handler
    const saveHandler = isAnonymousProposalMode
      ? handleAnonymousClassUpdate
      : isSuggestionMode
      ? handleSuggestClassUpdate
      : handleUpdateClass;
    await saveHandler(classIri, payload);
  }, [session, canWrite, projectId, activeBranch, isAnonymousProposalMode, isSuggestionMode, handleUpdateClass, handleSuggestClassUpdate, handleAnonymousClassUpdate]);

  // Handle branch change
  const handleBranchChange = useCallback((branchName: string) => {
    if (branchName === activeBranch) return;
    // Initial synchronization must preserve a resumed session.
    if (activeBranch && suggestionSession.isActive) {
      suggestionSession.discardSession();
    }
    setActiveBranch(branchName);
    resetSourceState();
    // Merge into existing search params instead of replacing — BranchSelector
    // fires this on mount, and replacing would wipe ?classIri= / ?propertyIri=
    // / ?individualIri= / ?resumeSession= that the page also depends on.
    const next = new URLSearchParams(searchParamsString);
    next.set("branch", branchName);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [activeBranch, pathname, router, suggestionSession, resetSourceState, searchParamsString]);

  // --- Keyboard shortcuts ---
  const keyboardShortcuts = useMemo((): ShortcutDefinition[] => [
    {
      id: "save",
      key: "s",
      modifiers: { ctrl: true },
      description: "Save / flush draft",
      category: "Editing",
      action: () => {
        // Trigger a blur on active element to flush auto-save drafts
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
      global: true,
      ignoreWhenEditorFocused: true,
    },
    ...(canSuggest ? [{
      id: "add-entity",
      key: "n",
      modifiers: { ctrl: true },
      description: "Add new entity",
      category: "Editing",
      action: () => handleAddEntity(),
      global: true,
    }] : []),
    {
      id: "help",
      key: "?",
      description: "Show keyboard shortcuts",
      category: "General",
      action: () => setShortcutDialogOpen(true),
    },
    {
      id: "escape",
      key: "Escape",
      description: "Close topmost overlay",
      category: "General",
      action: () => {
        if (shortcutDialogOpen) {
          setShortcutDialogOpen(false);
        } else if (showHistory) {
          setShowHistory(false);
        }
      },
      global: true,
      ignoreWhenEditorFocused: false,
    },
    // Suggestion curation shortcuts (D-16). Only registered when the project
    // has LLM access, and each is gated (shouldFire) on a suggestion card
    // actually owning focus — so a bare Enter/Delete/e never hijacks a focused
    // button/link elsewhere in the editor (H-1).
    ...(canUseLLM ? [
      {
        id: "suggestion-accept",
        key: "Enter",
        description: "Accept focused suggestion",
        category: "Suggestions",
        shouldFire: suggestionCardHasFocus,
        action: () => {
          const focused = document.activeElement?.closest('[role="listitem"]');
          if (focused) {
            const acceptBtn = focused.querySelector('[aria-label="Accept suggestion"]') as HTMLButtonElement | null;
            acceptBtn?.click();
          }
        },
      },
      {
        id: "suggestion-reject",
        key: "Delete",
        description: "Reject focused suggestion",
        category: "Suggestions",
        shouldFire: suggestionCardHasFocus,
        action: () => {
          const focused = document.activeElement?.closest('[role="listitem"]');
          if (focused) {
            const rejectBtn = focused.querySelector('[aria-label="Reject suggestion"]') as HTMLButtonElement | null;
            rejectBtn?.click();
          }
        },
      },
      {
        id: "suggestion-edit",
        key: "e",
        description: "Edit focused suggestion",
        category: "Suggestions",
        shouldFire: suggestionCardHasFocus,
        action: () => {
          const focused = document.activeElement?.closest('[role="listitem"]');
          if (focused) {
            const editBtn = focused.querySelector('[aria-label="Edit suggestion before accepting"]') as HTMLButtonElement | null;
            editBtn?.click();
          }
        },
      },
    ] : []),
  ], [handleAddEntity, shortcutDialogOpen, showHistory, canSuggest, canUseLLM]);

  useKeyboardShortcuts(keyboardShortcuts);

  // --- Render ---

  if (isLoading || isRetiredRedirecting || (status === "loading" && authMode === "required")) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {errorKind === "private-403" && !showAuthUI
                  ? "This is a private project"
                  : error || "Project not found"}
              </h2>
              {errorKind === "private-403" && !showAuthUI && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Sign-in is unavailable in this configuration, so private projects can&apos;t be opened here.
                </p>
              )}
              <div className="mt-4 flex items-center justify-center gap-3">
                {errorKind === "private-403" && showAuthUI && (
                  <Button onClick={() => signIn("zitadel", { callbackUrl: window.location.href })} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                )}
                <Link href="/">
                  <Button variant="outline">Back to Projects</Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Auth guard: redirect unauthenticated or unauthorized users to the viewer —
  // UNLESS anonymous proposal mode applies (AUTH_MODE != required + public
  // project): those users are this page's audience in propose mode (PR-7).
  // In auth-disabled mode there is never a session, so an edit-capable API role
  // (reported by hasValidAccess) keeps the visitor in the editor.
  if (((status === "unauthenticated" && !hasValidAccess) || (project && !canSuggest)) && !canPropose) {
    router.replace(`/projects/${projectId}`);
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        </main>
      </>
    );
  }

  if (!hasOntology) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${projectId}`}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <h1 className="font-semibold text-slate-900 dark:text-white">{project.name}</h1>
              </div>
              {canManage && !writesWithoutToken && (
                <Link href={`/projects/${projectId}/settings`}>
                  <Button variant="ghost" size="sm" title="Project settings" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <NoOntologyFileEmptyState projectId={projectId} settingsAvailable={!writesWithoutToken} canManage={canManage} />
        </main>
      </>
    );
  }

  return (
    <BranchProvider projectId={projectId} accessToken={session?.accessToken} initialBranch={initialBranch} canEdit={!!canEdit}>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
        {sourceRevisionConflict && (
          <SourceRevisionConflictBanner
            conflict={sourceRevisionConflict}
            isLoadingLatest={isLoadingLatest}
            onLoadLatest={handleLoadLatest}
          />
        )}
        {/* Editor Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-semibold text-slate-900 dark:text-white">{project.name}</h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">{totalClasses} classes</span>
              {/* Viewer / Editor switcher */}
              <ViewerEditorSwitcher projectId={projectId} />
              {/* Standard / Developer mode switcher */}
              <ModeSwitcher />
              {/* Suggestion mode indicator */}
              {isSuggestionMode && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lightbulb className="h-3 w-3" />
                  Suggesting
                </span>
              )}

              {/* Anonymous proposal mode indicator */}
              {isAnonymousProposalMode && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Pencil className="h-3 w-3" />
                  Proposing
                </span>
              )}

              {/* Sign-in CTA for unauthenticated users (only when an identity provider is active) */}
              {!hasValidAccess && showAuthUI && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signIn("zitadel", { callbackUrl: window.location.href })}
                  className="gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30"
                >
                  <LogIn className="h-3 w-3" />
                  Sign in to edit
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Submit Suggestions button */}
              {isSuggestionMode && suggestionSession.changesCount > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setSubmitDialogOpen(true)}
                >
                  <Lightbulb className="h-4 w-4" />
                  {suggestionSession.isResumed ? "Resubmit Suggestions" : "Submit Suggestions"}
                  <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-xs">
                    {suggestionSession.changesCount}
                  </span>
                </Button>
              )}

              {/* Submit Proposal button (anonymous mode) */}
              {isAnonymousProposalMode && anonymousSuggestion.changesCount > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setCreditModalOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Submit Proposal
                  <span className="rounded-full bg-emerald-500/30 px-1.5 py-0.5 text-xs">
                    {anonymousSuggestion.changesCount}
                  </span>
                </Button>
              )}

              {/* Discard Proposal button (anonymous mode) */}
              {isAnonymousProposalMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  onClick={() => setDiscardProposalConfirmOpen(true)}
                >
                  Discard
                </Button>
              )}

              {/* Suggestions link */}
              {isSuggestionMode && (
                <Link href={`/projects/${projectId}/suggestions`}>
                  <Button variant="ghost" size="sm" className="gap-2 text-amber-600 dark:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                    <span className="hidden sm:inline">My Suggestions</span>
                  </Button>
                </Link>
              )}

              {/* Review Suggestions link (editors/admins only) */}
              {canEdit && pendingSuggestionCount > 0 && (
                <Link href={`/projects/${projectId}/suggestions/review`}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Review</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {pendingSuggestionCount}
                    </span>
                  </Button>
                </Link>
              )}

              {/* WebSocket Connection Status */}
              <div className="flex items-center gap-1">
                <ConnectionStatus
                  state="disabled"
                  purpose="Real-time collaboration (coming soon)"
                  endpoint="/api/v1/collab/ws"
                />
                <ConnectionStatus
                  state={connectionStatus}
                  purpose={wsPurpose}
                  endpoint={wsEndpoint}
                />
              </div>

              {/* Branch Selector */}
              <BranchSelector onBranchChange={handleBranchChange} canCreateBranch={canEdit} readOnly={!hasValidAccess} />

              {/* Share */}
              <ShareButton
                projectId={projectId}
                selectedIri={selectedIri}
                selectedLabel={selectedNodeFallback?.label}
              />

              {/* History Button */}
              <HistoryButton onClick={() => setShowHistory(!showHistory)} isOpen={showHistory} />

              {/* Remote Sync Status (auth-only) */}
              {hasValidAccess && (
                <RemoteSyncIndicator
                  projectId={projectId}
                  accessToken={session?.accessToken}
                />
              )}

              {/* Normalization Status (auth-only) */}
              {hasValidAccess && normalizationStatus?.needs_normalization && (
                <Link href={`/projects/${projectId}/settings#normalization`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                    title="Ontology normalization recommended"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Normalize</span>
                  </Button>
                </Link>
              )}

              {/* Health Check */}
              <Button
                variant={showHealthCheck ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowHealthCheck(!showHealthCheck)}
                className="gap-2"
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Health</span>
                {lintSummary && lintSummary.total_issues > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                    lintSummary.error_count > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : lintSummary.warning_count > 0
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {lintSummary.total_issues}
                  </span>
                )}
              </Button>

              {/* PR Link */}
              <Link href={`/projects/${projectId}/pull-requests`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  <span className="hidden sm:inline">PRs</span>
                  {openPRCount > 0 && (
                    <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                      {openPRCount}
                    </span>
                  )}
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShortcutDialogOpen(true)}
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>

              {canManage && !writesWithoutToken && (
                <Link href={`/projects/${projectId}/settings`}>
                  <Button variant="ghost" size="sm" title="Project settings" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main Editor Layout — mode-dependent */}
        <div className="relative flex h-[calc(100vh-4rem-3.5rem)]">
          <div className="flex-1 flex overflow-hidden">
            {editorMode === "developer" ? (
              <div className="flex-1 flex flex-col">
                <DeveloperEditorLayout
                  projectId={projectId}
                  accessToken={session?.accessToken}
                  activeBranch={isAnonymousProposalMode && anonymousSuggestion.branch ? anonymousSuggestion.branch : activeBranch}
                  canEdit={isAnonymousProposalMode ? true : !!canEdit}
                  userRole={project?.user_role}
                  entityNavigationRef={entityNavigationRef}
                  canSuggest={!!canSuggest}
                  trustGate={trustGate}
                  isSuggestionMode={isAnonymousProposalMode ? true : isSuggestionMode}
                  nodes={nodes}
                  isTreeLoading={isTreeLoading}
                  treeError={treeError}
                  selectedIri={selectedIri}
                  selectNode={selectNode}
                  expandNode={expandNode}
                  collapseNode={collapseNode}
                  expandOneLevel={expandOneLevel}
                  expandAllFully={expandAllFully}
                  collapseAll={collapseAll}
                  collapseOneLevel={collapseOneLevel}
                  hasExpandableNodes={hasExpandableNodes}
                  hasExpandedNodes={hasExpandedNodes}
                  isExpandingAll={isExpandingAll}
                  navigateToNode={navigateToNode}
                  sourceContent={sourceContent}
                  setSourceContent={setSourceContent as (content: string | ((prev: string) => string)) => void}
                  isLoadingSource={isLoadingSource}
                  sourceError={sourceError}
                  isPreloading={isPreloading}
                  loadSourceContent={loadSourceContent}
                  sourceIriIndex={sourceIriIndex}
                  pendingScrollIri={pendingScrollIri}
                  setPendingScrollIri={setPendingScrollIri}
                  sourceEditorRef={sourceEditorRef}
                  onSaveSource={handleSaveSource}
                  onAddEntity={handleAddEntity}
                  onDeleteClass={handleDeleteClass}
                  onCopyIri={handleCopyIri}
                  selectedNodeFallback={selectedNodeFallback}
                  onUpdateClass={
                    isAnonymousProposalMode
                      ? handleAnonymousClassUpdate
                      : isSuggestionMode
                      ? handleSuggestClassUpdate
                      : handleUpdateClass
                  }
                  detailRefreshKey={detailRefreshKey}
                  onUpdateProperty={
                    isAnonymousProposalMode
                      ? handleAnonymousPropertyUpdate
                      : isSuggestionMode
                      ? handleSuggestPropertyUpdate
                      : handleUpdateProperty
                  }
                  onUpdateIndividual={
                    isAnonymousProposalMode
                      ? handleAnonymousIndividualUpdate
                      : isSuggestionMode
                      ? handleSuggestIndividualUpdate
                      : handleUpdateIndividual
                  }
                  onReparentClass={handleReparentClass}
                  reparentOptimistic={reparentOptimistic}
                  rollbackReparent={rollbackReparent}
                  showSignInToEdit={!hasValidAccess && showAuthUI && !canPropose}
                  onSignInToEdit={() => signIn("zitadel", { callbackUrl: window.location.href })}
                  canPropose={canPropose && !isAnonymousProposalMode}
                  onProposeEdit={handleProposeEdit}
                  isProposeEditStarting={anonymousSuggestion.isStarting}
                  isAnonymousProposalMode={isAnonymousProposalMode}
                  onAddSuggestedChild={handleAddSuggestedChild}
                  onAddSuggestedProperty={handleAddSuggestedProperty}
                  acceptedSuggestionIris={acceptedSuggestionIris}
                />
              </div>
            ) : (
              <StandardEditorLayout
                projectId={projectId}
                accessToken={session?.accessToken}
                activeBranch={isAnonymousProposalMode && anonymousSuggestion.branch ? anonymousSuggestion.branch : activeBranch}
                canEdit={isAnonymousProposalMode ? true : !!canEdit}
                userRole={project?.user_role}
                canSuggest={!!canSuggest}
                trustGate={trustGate}
                entityNavigationRef={entityNavigationRef}
                isSuggestionMode={isAnonymousProposalMode ? true : isSuggestionMode}
                nodes={nodes}
                isTreeLoading={isTreeLoading}
                treeError={treeError}
                selectedIri={selectedIri}
                selectNode={selectNode}
                expandNode={expandNode}
                collapseNode={collapseNode}
                expandOneLevel={expandOneLevel}
                expandAllFully={expandAllFully}
                collapseAll={collapseAll}
                collapseOneLevel={collapseOneLevel}
                hasExpandableNodes={hasExpandableNodes}
                hasExpandedNodes={hasExpandedNodes}
                isExpandingAll={isExpandingAll}
                navigateToNode={navigateToNode}
                onAddEntity={handleAddEntity}
                onDeleteClass={handleDeleteClass}
                onCopyIri={handleCopyIri}
                selectedNodeFallback={selectedNodeFallback}
                onUpdateClass={
                  isAnonymousProposalMode
                    ? handleAnonymousClassUpdate
                    : isSuggestionMode
                    ? handleSuggestClassUpdate
                    : handleUpdateClass
                }
                detailRefreshKey={detailRefreshKey}
                sourceContent={sourceContent}
                onUpdateProperty={
                    isAnonymousProposalMode
                      ? handleAnonymousPropertyUpdate
                      : isSuggestionMode
                      ? handleSuggestPropertyUpdate
                      : handleUpdateProperty
                  }
                onUpdateIndividual={
                    isAnonymousProposalMode
                      ? handleAnonymousIndividualUpdate
                      : isSuggestionMode
                      ? handleSuggestIndividualUpdate
                      : handleUpdateIndividual
                  }
                onReparentClass={handleReparentClass}
                reparentOptimistic={reparentOptimistic}
                rollbackReparent={rollbackReparent}
                showSignInToEdit={!hasValidAccess && showAuthUI && !canPropose}
                onSignInToEdit={() => signIn("zitadel", { callbackUrl: window.location.href })}
                canPropose={canPropose && !isAnonymousProposalMode}
                onProposeEdit={handleProposeEdit}
                isProposeEditStarting={anonymousSuggestion.isStarting}
                isAnonymousProposalMode={isAnonymousProposalMode}
                onAddSuggestedChild={handleAddSuggestedChild}
                onAddSuggestedProperty={handleAddSuggestedProperty}
                acceptedSuggestionIris={acceptedSuggestionIris}
              />
            )}
          </div>

          {/* Right Panel - Health Check (available in both modes) */}
          {showHealthCheck && (
            <div className="w-96 flex-shrink-0">
              <HealthCheckPanel
                projectId={projectId}
                accessToken={session?.accessToken}
                branch={activeBranch}
                isOpen={showHealthCheck}
                onClose={() => setShowHealthCheck(false)}
                onNavigateToClass={(iri, subjectType) => {
                  if (entityNavigationRef.current) {
                    entityNavigationRef.current(iri, subjectType);
                  } else {
                    navigateToNode(iri);
                  }
                }}
                canRunLint={!!canManage}
              />
            </div>
          )}

          {/* Right Panel - Revision History (available in both modes) */}
          <RevisionHistoryPanel
            projectId={projectId}
            accessToken={session?.accessToken}
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
          />
        </div>
      </main>

      {/* Commit Message Dialog */}
      <CommitMessageDialog
        open={commitDialogOpen}
        onOpenChange={handleCommitDialogClose}
        onConfirm={handleCommitConfirm}
        defaultMessage="Update ontology"
      />

      {/* Add Entity Dialog (only for users with edit/suggest permissions) */}
      {canSuggest && (
        <AddEntityDialog
          open={addEntityDialogOpen}
          onOpenChange={setAddEntityDialogOpen}
          onConfirm={handleEntityConfirm}
          iriPattern={iriPattern}
          nextNumeric={nextNumeric}
          ontologyNamespace={ontologyNamespace}
          parentIri={addEntityParentIri}
          parentLabel={addEntityParentLabel}
          trustGate={trustGate}
        />
      )}

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteImpactAcknowledged(true);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Class"
        description={`Are you sure you want to delete "${deleteTargetLabel}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        confirmDisabled={!deleteImpactAcknowledged}
      >
        <DeleteImpactAnalysis
          projectId={projectId}
          entityIri={deleteTargetIri}
          accessToken={session?.accessToken}
          branch={activeBranch}
          onAcknowledge={setDeleteImpactAcknowledged}
        />
      </ConfirmDialog>

      {/* Suggestion Submit Dialog */}
      {isSuggestionMode && (
        <SuggestionSubmitDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          onConfirm={suggestionSession.isResumed ? suggestionSession.resubmitSession : suggestionSession.submitSession}
          entitiesModified={suggestionSession.entitiesModified}
          changesCount={suggestionSession.changesCount}
        />
      )}

      {/* Keyboard Shortcut Help Dialog */}
      <KeyboardShortcutDialog
        open={shortcutDialogOpen}
        onOpenChange={setShortcutDialogOpen}
        shortcuts={keyboardShortcuts}
      />

      {/* Credit Modal for anonymous proposal submissions — opens before submit to collect optional credit info */}
      <ConfirmDialog
        open={discardProposalConfirmOpen}
        onOpenChange={setDiscardProposalConfirmOpen}
        title="Discard proposal?"
        description="All changes in this anonymous proposal will be permanently discarded. This cannot be undone."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => {
          setDiscardProposalConfirmOpen(false);
          anonymousSuggestion.discardSession();
        }}
      />
      <CreditModal
        open={creditModalOpen}
        onSubmitCredit={handleAnonymousSubmit}
      />

      {/* Anonymous submit-success + account nudge (R7) */}
      <ProposalSubmittedDialog
        open={!!submittedProposal}
        onOpenChange={(open) => { if (!open) setSubmittedProposal(null); }}
        prNumber={submittedProposal?.prNumber ?? null}
        prUrl={submittedProposal?.prUrl ?? null}
        isSignedIn={!!session?.accessToken}
        onSignIn={
          showAuthUI
            ? () => signIn("zitadel", { callbackUrl: window.location.href })
            : undefined
        }
      />
    </BranchProvider>
  );
}

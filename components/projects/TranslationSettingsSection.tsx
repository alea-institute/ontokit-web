"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/editor/LanguagePicker";
import { useTranslationConfig } from "@/lib/hooks/useTranslationConfig";
import type {
  TranslationConfigResponse,
  TranslationConfigUpdate,
  TranslationLanguage,
} from "@/lib/api/translations";
import { getTranslationErrorMessage, translationsApi } from "@/lib/api/translations";
import type { ProjectMember } from "@/lib/api/projects";
import { useMembers } from "@/lib/hooks/useMembers";

const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white";
const NO_REVIEWER_LANGUAGES: string[] = [];

function editableConfig(config: TranslationConfigResponse): TranslationConfigUpdate {
  const { verifier_api_key_set: _keySet, ...editable } = config;
  return editable;
}

export function TranslationSettingsSection({
  projectId,
  accessToken,
  canManage,
}: {
  projectId: string;
  accessToken?: string;
  canManage: boolean;
}) {
  const { config, palette, isLoading, error, updateConfig, isUpdating } =
    useTranslationConfig(projectId, accessToken);
  const [form, setForm] = useState<TranslationConfigUpdate | null>(null);
  const [languageDraft, setLanguageDraft] = useState("");
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // The query result is the baseline for this deliberately local, failure-preserving form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (config) setForm(editableConfig(config));
  }, [config]);

  const dirty = useMemo(() => {
    if (!config || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(editableConfig(config));
  }, [config, form]);

  if (!canManage) return null;
  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading translation settings…
      </div>
    );
  }
  if (error || !form || !config) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {getTranslationErrorMessage(error, "Couldn't load translation settings. Reload the page and try again.")}
      </p>
    );
  }

  const threshold =
    form.verification_mechanism === "consensus"
      ? form.consensus_threshold
      : form.confidence_threshold;
  const modelError =
    !!form.verifier_provider?.trim() && !form.verifier_model?.trim();
  const languageError =
    form.language_tags.length === 0 ||
    form.language_tags.some((tag) => !BCP47_PATTERN.test(tag));
  const thresholdError = threshold < 0 || threshold > 1;
  const valid = !modelError && !languageError && !thresholdError;

  const patchForm = (patch: Partial<TranslationConfigUpdate>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setSaveError(null);
    setSaved(false);
  };
  const addLanguage = () => {
    const tag = languageDraft.trim();
    if (!BCP47_PATTERN.test(tag) || form.language_tags.includes(tag)) return;
    patchForm({ language_tags: [...form.language_tags, tag] });
    setLanguageDraft("");
    setAddingLanguage(false);
  };
  const handleSave = async () => {
    if (!valid || !dirty) return;
    setSaveError(null);
    setSaved(false);
    try {
      const response = await updateConfig(form);
      setForm(editableConfig(response));
      setSaved(true);
    } catch (caught) {
      setSaveError(
        getTranslationErrorMessage(caught, "Translation settings could not be saved."),
      );
    }
  };
  const paletteByTag = new Map(palette.map((language) => [language.tag, language]));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Choose target languages and how machine translations are verified before they are committed.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target languages</legend>
        <div className="flex flex-wrap gap-2">
          {form.language_tags.map((tag) => {
            const language = paletteByTag.get(tag);
            const label = language?.english_name ?? tag;
            return (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {label} <span className="text-xs text-slate-500">({tag})</span>
                <button type="button" aria-label={`Remove ${label}`} onClick={() => patchForm({ language_tags: form.language_tags.filter((item) => item !== tag) })} className="rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
        {addingLanguage ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LanguagePicker value={languageDraft} onChange={setLanguageDraft} />
              <Button type="button" variant="outline" onClick={addLanguage} disabled={!BCP47_PATTERN.test(languageDraft) || form.language_tags.includes(languageDraft)} aria-label="Add selected language">Add</Button>
              <Button type="button" variant="ghost" onClick={() => setAddingLanguage(false)}>Cancel</Button>
            </div>
            <div aria-label="Language palette" className="flex flex-wrap gap-1.5">
              {palette.filter((language) => !form.language_tags.includes(language.tag)).map((language) => (
                <button key={language.tag} type="button" onClick={() => setLanguageDraft(language.tag)} aria-pressed={languageDraft === language.tag} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 aria-pressed:border-primary-500 aria-pressed:text-primary-700 dark:border-slate-600 dark:text-slate-300">
                  {language.english_name} ({language.tag})
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAddingLanguage(true)} className="gap-2"><Plus className="h-4 w-4" /> Add language</Button>
        )}
        {languageError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">Add at least one valid BCP 47 language tag.</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Verification mechanism</legend>
        <div className="flex flex-wrap gap-6">
          {(["consensus", "confidence"] as const).map((mechanism) => (
            <label key={mechanism} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm capitalize text-slate-700 dark:text-slate-300">
              <input type="radio" name="translation-mechanism" checked={form.verification_mechanism === mechanism} onChange={() => patchForm({ verification_mechanism: mechanism })} className="h-4 w-4 focus:ring-primary-500" />
              {mechanism}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="translation-threshold" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">{form.verification_mechanism === "consensus" ? "Consensus" : "Confidence"} threshold</label>
        <input id="translation-threshold" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => patchForm(form.verification_mechanism === "consensus" ? { consensus_threshold: Number(event.target.value) } : { confidence_threshold: Number(event.target.value) })} aria-invalid={thresholdError} className={inputClass} />
        {thresholdError && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">Threshold must be between 0 and 1.</p>}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Fields to translate</legend>
        <div className="space-y-1">
          <Check label="Definitions" checked={form.translate_definitions} onChange={(checked) => patchForm({ translate_definitions: checked })} />
          <Check label="Examples" checked={form.translate_examples} onChange={(checked) => patchForm({ translate_examples: checked })} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Translation speed</legend>
        <div className="flex flex-wrap gap-6">
          {(["batch", "fast"] as const).map((mode) => (
            <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm capitalize text-slate-700 dark:text-slate-300">
              <input type="radio" name="translation-speed" checked={form.speed_mode === mode} onChange={() => patchForm({ speed_mode: mode })} className="h-4 w-4 focus:ring-primary-500" /> {mode}
            </label>
          ))}
        </div>
      </fieldset>

      <Check label="Require the provisional translation gate" checked={form.provisional_gate} onChange={(checked) => patchForm({ provisional_gate: checked })} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="translation-primary-provider" label="Primary provider" value={form.primary_provider ?? ""} onChange={(value) => patchForm({ primary_provider: value || null })} describedBy="translation-primary-provider-hint" />
        <Field id="translation-primary-model" label="Primary model" value={form.primary_model ?? ""} onChange={(value) => patchForm({ primary_model: value || null })} describedBy={!form.primary_model?.trim() ? "translation-primary-model-hint" : undefined} />
      </div>
      <div className="-mt-4 grid gap-1 sm:grid-cols-2">
        <p id="translation-primary-provider-hint" className="text-xs text-slate-500 dark:text-slate-400">Leave blank to use the project&apos;s LLM provider.</p>
        {!form.primary_model?.trim() && <p id="translation-primary-model-hint" className="text-xs text-slate-500 dark:text-slate-400">Primary model is required for translation to run.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="translation-verifier-provider" label="Verifier provider" value={form.verifier_provider ?? ""} onChange={(value) => patchForm({ verifier_provider: value || null })} />
        <Field id="translation-verifier-model" label="Verifier model" value={form.verifier_model ?? ""} onChange={(value) => patchForm({ verifier_model: value || null })} invalid={modelError} />
      </div>
      {modelError && <p role="alert" className="-mt-4 text-xs text-red-600 dark:text-red-400">Verifier model is required when a provider is set.</p>}
      <div>
        <Field id="translation-verifier-key" label="Verifier API key" type="password" value={form.verifier_api_key ?? ""} onChange={(value) => patchForm({ verifier_api_key: value || undefined })} autoComplete="new-password" />
        <p className="mt-1 text-xs text-slate-500">{config.verifier_api_key_set ? "A verifier key is set. Enter a new key only to replace it." : "Leave blank to use the project's primary LLM key."}</p>
      </div>

      {saveError && <><p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p><p className="text-xs text-red-600 dark:text-red-400">The verifier settings were not saved; your entered values are still here.</p></>}
      {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">Translation settings saved.</p>}
      <Button type="button" onClick={handleSave} disabled={!dirty || !valid || isUpdating} className="gap-2">
        {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
        {isUpdating ? "Saving…" : "Save translation settings"}
      </Button>

      <ReviewerSettings projectId={projectId} accessToken={accessToken} palette={palette} />
    </div>
  );
}

function ReviewerSettings({
  projectId,
  accessToken,
  palette,
}: {
  projectId: string;
  accessToken?: string;
  palette: TranslationLanguage[];
}) {
  const queryClient = useQueryClient();
  const queryKey = ["translation-reviewers", projectId, accessToken ?? null] as const;
  const membersQuery = useMembers(projectId, accessToken);
  const reviewersQuery = useQuery({
    queryKey,
    queryFn: () => translationsApi.listReviewers(projectId, accessToken!),
    enabled: !!accessToken,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: ({ memberId, languages }: { memberId: string; languages: string[] }) =>
      translationsApi.updateReviewer(projectId, memberId, languages, accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["translation-reviewers", projectId] }),
  });

  if (membersQuery.isLoading || reviewersQuery.isLoading) {
    return <p role="status" className="text-sm text-slate-500">Loading native-speaker reviewers…</p>;
  }
  if (membersQuery.error || reviewersQuery.error) {
    return <p role="alert" className="text-sm text-red-600">{getTranslationErrorMessage(membersQuery.error || reviewersQuery.error, "Reviewers could not be loaded.")}</p>;
  }

  const assignments = new Map(reviewersQuery.data?.map((reviewer) => [reviewer.member_id, reviewer.languages]));
  return (
    <section aria-labelledby="translation-reviewers-heading" className="border-t border-slate-200 pt-5 dark:border-slate-700">
      <h3 id="translation-reviewers-heading" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Native-speaker reviewers</h3>
      <p className="mt-1 text-xs text-slate-500">Assign the language tags each project member may review.</p>
      <div className="mt-3 space-y-3">
        {membersQuery.data?.items.map((member) => (
          <ReviewerRow
            key={member.id}
            member={member}
            initialLanguages={assignments.get(member.id) ?? NO_REVIEWER_LANGUAGES}
            palette={palette}
            save={(languages) => updateMutation.mutateAsync({ memberId: member.id, languages })}
            saving={updateMutation.isPending && updateMutation.variables?.memberId === member.id}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewerRow({ member, initialLanguages, palette, save, saving }: {
  member: ProjectMember;
  initialLanguages: string[];
  palette: TranslationLanguage[];
  save: (languages: string[]) => Promise<unknown>;
  saving: boolean;
}) {
  const [languages, setLanguages] = useState(initialLanguages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setLanguages(initialLanguages); }, [initialLanguages]);
  const name = member.user?.name || member.user?.email || member.user_id;
  const dirty = JSON.stringify(languages) !== JSON.stringify(initialLanguages);
  const add = () => {
    const tag = draft.trim();
    if (!BCP47_PATTERN.test(tag) || languages.includes(tag)) return;
    setLanguages((current) => [...current, tag]);
    setDraft(""); setSaved(false); setError(null);
  };
  const handleSave = async () => {
    setError(null); setSaved(false);
    try { await save(languages); setSaved(true); }
    catch (caught) { setError(getTranslationErrorMessage(caught, `Reviewer languages for ${name} could not be saved.`)); }
  };
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 text-sm font-medium">{name}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {languages.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">{palette.find((item) => item.tag === tag)?.english_name ?? tag} ({tag})<button type="button" aria-label={`Remove ${tag} from ${name}`} onClick={() => { setLanguages((current) => current.filter((item) => item !== tag)); setSaved(false); }}><X className="h-3 w-3" /></button></span>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1"><LanguagePicker value={draft} onChange={setDraft} ariaLabel={`Language tag for ${name}`} /></div>
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!BCP47_PATTERN.test(draft) || languages.includes(draft)}>Add</Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving}>{saving ? "Saving…" : "Save reviewer"}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && <p role="status" className="mt-2 text-xs text-green-700">Reviewer languages saved.</p>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded focus:ring-primary-500" />{label}</label>;
}

function Field({ id, label, value, onChange, type = "text", invalid, autoComplete, describedBy }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; invalid?: boolean; autoComplete?: string; describedBy?: string }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid} aria-describedby={describedBy} autoComplete={autoComplete} className={inputClass} /></div>;
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Cpu,
  Sparkles,
  Bot,
  Star,
  Zap,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLLMConfig } from "@/lib/hooks/useLLMConfig";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";
import type { LLMProviderType, ModelTier } from "@/lib/api/llm";

// ── Provider metadata ──────────────────────────────────────────────────

interface ProviderOption {
  value: LLMProviderType;
  label: string;
  requiresApiKey: boolean;
  isLocal: boolean;
  defaultEndpoint?: string;
}

const PROVIDERS: ProviderOption[] = [
  { value: "openai", label: "OpenAI", requiresApiKey: true, isLocal: false },
  { value: "anthropic", label: "Anthropic", requiresApiKey: true, isLocal: false },
  { value: "google", label: "Google", requiresApiKey: true, isLocal: false },
  { value: "mistral", label: "Mistral", requiresApiKey: true, isLocal: false },
  { value: "cohere", label: "Cohere", requiresApiKey: true, isLocal: false },
  { value: "meta_llama", label: "Meta Llama", requiresApiKey: true, isLocal: false },
  { value: "groq", label: "Groq", requiresApiKey: true, isLocal: false },
  { value: "xai", label: "xAI", requiresApiKey: true, isLocal: false },
  { value: "github_models", label: "GitHub Models", requiresApiKey: true, isLocal: false },
  { value: "ollama", label: "Ollama (local)", requiresApiKey: false, isLocal: true, defaultEndpoint: "http://localhost:11434" },
  { value: "lmstudio", label: "LM Studio (local)", requiresApiKey: false, isLocal: true, defaultEndpoint: "http://localhost:1234" },
  { value: "llamafile", label: "Llamafile (local)", requiresApiKey: false, isLocal: true, defaultEndpoint: "http://localhost:8080" },
  { value: "custom", label: "Custom endpoint", requiresApiKey: false, isLocal: true },
];

function getProviderIcon(provider: LLMProviderType) {
  switch (provider) {
    case "openai":
      return <Sparkles className="h-4 w-4" />;
    case "anthropic":
      return <Bot className="h-4 w-4" />;
    case "google":
      return <Star className="h-4 w-4" />;
    case "cohere":
      return <Zap className="h-4 w-4" />;
    case "ollama":
    case "lmstudio":
    case "llamafile":
      return <Cpu className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
}

// ── Component ──────────────────────────────────────────────────────────

export function LLMSettingsSection({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const { config, isLoading, updateConfig, isUpdating, testConnection } =
    useLLMConfig(projectId, accessToken);

  const byoKeyStore = useByoKeyStore();

  // Form state
  const [provider, setProvider] = useState<LLMProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelTier, setModelTier] = useState<ModelTier>("quality");
  const [baseUrl, setBaseUrl] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [isByoEnabled, setIsByoEnabled] = useState(false);
  const [byoKey, setByoKey] = useState("");

  // Validation state
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedOption, setFocusedOption] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Sync form state from loaded config
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModelTier(config.model_tier);
      setBaseUrl(config.base_url ?? "");
      setMonthlyBudget(
        config.monthly_budget_usd != null
          ? String(config.monthly_budget_usd)
          : ""
      );
      setDailyCap(
        config.daily_cap_usd != null ? String(config.daily_cap_usd) : ""
      );
    }
    // Sync BYO key store state
    const entry = byoKeyStore.getEntry(projectId);
    if (entry) {
      setIsByoEnabled(true);
      setByoKey(entry.key);
    }
  }, [config, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set default endpoint when switching to a local provider
  useEffect(() => {
    const opt = PROVIDERS.find((p) => p.value === provider);
    if (opt?.isLocal && opt.defaultEndpoint && !baseUrl) {
      setBaseUrl(opt.defaultEndpoint);
    }
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        setFocusedOption(-1);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Clear validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  const clearValidationAfterDelay = useCallback(() => {
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    validationTimerRef.current = setTimeout(() => {
      setValidationStatus("idle");
      setValidationError(null);
    }, 5000);
  }, []);

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;
  const isLocalProvider = selectedProvider.isLocal;
  const currentIndex = PROVIDERS.findIndex((p) => p.value === provider);

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsDropdownOpen(true);
        setFocusedOption(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedOption((i) => Math.min(i + 1, PROVIDERS.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedOption((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedOption >= 0) {
          setProvider(PROVIDERS[focusedOption].value);
          setIsDropdownOpen(false);
          setFocusedOption(-1);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsDropdownOpen(false);
        setFocusedOption(-1);
        break;
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (validationStatus !== "idle") {
      setValidationStatus("idle");
      setValidationError(null);
    }
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setError(null);
    setSuccess(null);

    try {
      // BYO key management
      if (isByoEnabled && byoKey.trim()) {
        byoKeyStore.setKey(projectId, provider, byoKey.trim());
      } else if (!isByoEnabled) {
        byoKeyStore.clearKey(projectId);
      }

      // Validate key if provided
      if (apiKey.trim() || (isByoEnabled && byoKey.trim())) {
        setValidationStatus("validating");
        try {
          const result = await testConnection(
            isByoEnabled && byoKey.trim() ? byoKey.trim() : undefined
          );
          if (result.success) {
            setValidationStatus("valid");
            byoKeyStore.markValidated(projectId);
            clearValidationAfterDelay();
          } else {
            setValidationStatus("invalid");
            setValidationError(
              result.error ??
                `This API key was rejected by ${selectedProvider.label}. Check that it's correct and has the right permissions.`
            );
            clearValidationAfterDelay();
            return;
          }
        } catch {
          setValidationStatus("invalid");
          setValidationError(
            `Could not reach ${selectedProvider.label}. Check your endpoint URL and try again.`
          );
          clearValidationAfterDelay();
          return;
        }
      }

      await updateConfig({
        provider,
        model_tier: modelTier,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        ...(isLocalProvider && baseUrl.trim()
          ? { base_url: baseUrl.trim() }
          : { base_url: null }),
        monthly_budget_usd: monthlyBudget.trim()
          ? parseFloat(monthlyBudget)
          : null,
        daily_cap_usd: dailyCap.trim() ? parseFloat(dailyCap) : null,
      });

      setApiKey("");
      setSuccess("AI settings saved.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Settings could not be saved. Try again, or reload the page if the problem continues."
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-16 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const isNoConfig = !config;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Configure the LLM provider for AI-assisted suggestions on this project.
      </p>

      {isNoConfig && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No AI provider configured
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add a provider to enable LLM-assisted suggestions for all project
            members.
          </p>
        </div>
      )}

      {/* Provider dropdown */}
      <div>
        <label
          htmlFor="llm-provider-trigger"
          className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          LLM Provider
        </label>
        <div className="relative" ref={dropdownRef}>
          <button
            id="llm-provider-trigger"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-controls="llm-provider-listbox"
            onClick={() => {
              setIsDropdownOpen((open) => !open);
              setFocusedOption(currentIndex >= 0 ? currentIndex : 0);
            }}
            onKeyDown={handleDropdownKeyDown}
            className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {getProviderIcon(provider)}
            <span className="flex-1 text-left">{selectedProvider.label}</span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isDropdownOpen && (
            <ul
              id="llm-provider-listbox"
              ref={listboxRef}
              role="listbox"
              aria-label="LLM Provider"
              className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              {PROVIDERS.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === provider}
                  data-focused={idx === focusedOption}
                  onClick={() => {
                    setProvider(opt.value);
                    setIsDropdownOpen(false);
                    setFocusedOption(-1);
                  }}
                  onMouseEnter={() => setFocusedOption(idx)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 ${
                    idx === focusedOption
                      ? "bg-slate-50 dark:bg-slate-700"
                      : ""
                  }`}
                >
                  {getProviderIcon(opt.value)}
                  <span className="flex-1">{opt.label}</span>
                  {opt.value === provider && (
                    <Check className="h-3.5 w-3.5 text-primary-600" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* API key input — hidden for local providers */}
      {!isLocalProvider && (
        <div>
          <label
            htmlFor="llm-api-key"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            API Key
          </label>
          <div className="relative">
            <input
              id="llm-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={
                config?.api_key_set && config.provider === provider
                  ? "Key is set (enter new key to replace)"
                  : "sk-..."
              }
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              type="button"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Local endpoint URL — shown for local providers */}
      {isLocalProvider && (
        <div>
          <label
            htmlFor="llm-base-url"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Endpoint URL
          </label>
          <input
            id="llm-base-url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={selectedProvider.defaultEndpoint ?? "http://localhost:11434"}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
      )}

      {/* Model tier radio group */}
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Default model tier
        </p>
        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="model-tier"
              value="quality"
              checked={modelTier === "quality"}
              onChange={() => setModelTier("quality")}
              className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Quality
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="model-tier"
              value="cheap"
              checked={modelTier === "cheap"}
              onChange={() => setModelTier("cheap")}
              className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Cheap
            </span>
          </label>
        </div>
      </div>

      {/* Budget fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="llm-monthly-budget"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Monthly budget ceiling (USD)
          </label>
          <input
            id="llm-monthly-budget"
            type="number"
            min="0"
            step="1"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            placeholder="No cap"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank for no cap.</p>
        </div>
        <div>
          <label
            htmlFor="llm-daily-cap"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Daily sub-cap (USD, optional)
          </label>
          <input
            id="llm-daily-cap"
            type="number"
            min="0"
            step="1"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            placeholder="No cap"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank for no cap.</p>
        </div>
      </div>

      {/* BYO key toggle */}
      <div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isByoEnabled}
            onChange={(e) => {
              setIsByoEnabled(e.target.checked);
              if (!e.target.checked) {
                byoKeyStore.clearKey(projectId);
              }
            }}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Use my own API key (BYO)
          </span>
        </label>
        {isByoEnabled && (
          <div className="mt-2 space-y-2 pl-6">
            <p className="text-xs text-slate-500">
              Your key is stored in your browser only and billed directly to you.
            </p>
            <div className="relative">
              <input
                type="password"
                value={byoKey}
                onChange={(e) => setByoKey(e.target.value)}
                placeholder="sk-..."
                aria-label="BYO API key"
                autoComplete="new-password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Key validation status row */}
      {validationStatus !== "idle" && (
        <div className="flex items-center gap-2">
          {validationStatus === "validating" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Validating...
              </span>
            </>
          )}
          {validationStatus === "valid" && (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 dark:text-green-400">
                Key valid
              </span>
            </>
          )}
          {validationStatus === "invalid" && (
            <>
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600 dark:text-red-400">
                {validationError ??
                  `This API key was rejected by ${selectedProvider.label}. Check that it's correct and has the right permissions.`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Error / success messages */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
      )}

      {/* Save button */}
      <div>
        <Button
          onClick={handleSave}
          disabled={isUpdating}
          className="flex items-center gap-2"
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save AI Settings"
          )}
        </Button>
      </div>
    </div>
  );
}

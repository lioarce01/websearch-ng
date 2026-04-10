"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type LLMConfig, PROVIDERS } from "../hooks/useSettings";

interface Model { id: string; label: string }

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

export default function SettingsModal({ open, onClose, config, onSave }: SettingsModalProps) {
  const [draft, setDraft]           = useState<LLMConfig>(config);
  const [showKey, setShowKey]       = useState(false);
  const [models, setModels]         = useState<Model[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provider = PROVIDERS[draft.provider];
  const isOllama = draft.provider === "ollama";

  // Fetch models from backend whenever provider or API key changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Ollama & Anthropic don't need a key — fetch immediately
    const needsKey = !isOllama && draft.provider !== "anthropic";
    if (needsKey && !draft.apiKey.trim()) {
      setModels([]);
      setFetchError("");
      return;
    }

    const delay = needsKey ? 800 : 0;

    debounceRef.current = setTimeout(async () => {
      setFetchingModels(true);
      setFetchError("");
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: draft.provider, apiKey: draft.apiKey }),
        });
        const data = await res.json();
        if (data.error) {
          setFetchError(data.error);
          setModels([]);
        } else {
          setModels(data.models ?? []);
        }
      } catch {
        setFetchError("Could not reach backend");
        setModels([]);
      } finally {
        setFetchingModels(false);
      }
    }, delay);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.provider, draft.apiKey]);

  // Sync draft when modal reopens with latest saved config
  useEffect(() => {
    if (open) {
      setDraft(config);
      setShowKey(false);
    }
  }, [open, config]);

  const handleProviderChange = (p: string | null) => {
    if (!p) return;
    const def = PROVIDERS[p];
    setDraft({ provider: p, apiKey: "", fastModel: def.fastModel, mainModel: def.mainModel, rememberKey: draft.rememberKey });
    setModels([]);
    setFetchError("");
  };

  // When fetched models arrive, auto-correct the selected model if it's not in the list
  useEffect(() => {
    if (!models.length) return;
    const ids = models.map((m) => m.id);
    setDraft((prev) => ({
      ...prev,
      mainModel: ids.includes(prev.mainModel) ? prev.mainModel : (ids[0] ?? prev.mainModel),
      fastModel: ids.includes(prev.fastModel) ? prev.fastModel : (ids[0] ?? prev.fastModel),
    }));
  }, [models]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const modelOptions = models.length
    ? models.map((m) => ({ value: m.id, label: m.label }))
    : null; // null = use draft values as-is (no list to show)

  const ModelSelect = ({
    value,
    onChange,
    label,
    sublabel,
  }: {
    value: string;
    onChange: (v: string | null) => void;
    label: string;
    sublabel: string;
  }) => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
        {label} <span className="normal-case">({sublabel})</span>
      </label>
      <Select value={value} onValueChange={onChange} disabled={fetchingModels}>
        <SelectTrigger
          className="w-full bg-surface-alt border-white/10 text-foreground rounded-xl
                     focus:ring-0 focus:border-white/25 h-10 disabled:opacity-50"
        >
          {fetchingModels ? (
            <span className="flex items-center gap-2 text-foreground-muted text-sm">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading models…
            </span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        {modelOptions && (
          <SelectContent alignItemWithTrigger={false}className="bg-surface border-white/10 text-foreground rounded-xl max-h-60">
            {modelOptions.map((m) => (
              <SelectItem
                key={m.value}
                value={m.value}
                className="focus:bg-surface-alt focus:text-foreground cursor-pointer"
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        )}
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md bg-surface border border-white/10 text-foreground rounded-2xl
                   shadow-2xl shadow-black/60 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              LLM Settings
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground-muted mt-1">
              Bring your own API key. Stored locally, never sent to our servers.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Provider */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Provider
            </label>
            <Select value={draft.provider} onValueChange={handleProviderChange}>
              <SelectTrigger
                className="w-full bg-surface-alt border-white/10 text-foreground rounded-xl
                           focus:ring-0 focus:border-white/25 h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}className="bg-surface border-white/10 text-foreground rounded-xl">
                {Object.entries(PROVIDERS).map(([key, def]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className="focus:bg-surface-alt focus:text-foreground cursor-pointer"
                  >
                    {def.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                API Key
              </label>
              {!isOllama && (
                <a
                  href={provider.keyDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-plex hover:text-plex-dim transition-colors"
                >
                  Get key ↗
                </a>
              )}
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={isOllama ? "No key needed for local models" : provider.keyPlaceholder}
                value={draft.apiKey}
                disabled={isOllama}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                className="bg-surface-alt border-white/10 text-foreground placeholder:text-foreground-muted/50
                           rounded-xl focus-visible:ring-0 focus-visible:border-white/25 h-10 pr-20
                           disabled:opacity-40"
              />
              {!isOllama && (
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]
                             text-foreground-muted hover:text-foreground transition-colors"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              )}
            </div>

            {/* Fetch status */}
            {fetchError && (
              <p className="text-[11px] text-red-400/80">{fetchError}</p>
            )}
            {!fetchError && models.length > 0 && !fetchingModels && (
              <p className="text-[11px] text-green-400/70">
                {models.length} models loaded
              </p>
            )}
          </div>

          {/* Main model */}
          <ModelSelect
            label="Main model"
            sublabel="answers"
            value={draft.mainModel}
            onChange={(v) => v && setDraft({ ...draft, mainModel: v })}
          />

          {/* Fast model */}
          <ModelSelect
            label="Fast model"
            sublabel="query rewriting"
            value={draft.fastModel}
            onChange={(v) => v && setDraft({ ...draft, fastModel: v })}
          />

          {/* Remember key toggle */}
          {!isOllama && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <button
                type="button"
                role="switch"
                aria-checked={draft.rememberKey}
                onClick={() => setDraft((d) => ({ ...d, rememberKey: !d.rememberKey }))}
                className={`relative w-8 h-[18px] rounded-full transition-colors duration-200
                  ${draft.rememberKey ? "bg-plex" : "bg-white/15 group-hover:bg-white/20"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white
                              shadow transition-transform duration-200
                              ${draft.rememberKey ? "translate-x-3.5" : "translate-x-0"}`}
                />
              </button>
              <span className="text-xs text-foreground-muted leading-tight">
                Remember API key on this device
                <span className="block text-foreground-muted/50 mt-0.5">
                  {draft.rememberKey
                    ? "Key stored in localStorage — persists across sessions"
                    : "Key stored in sessionStorage — cleared when browser closes"}
                </span>
              </span>
            </label>
          )}

          {/* Info note */}
          <p className="text-[11px] text-foreground-muted/60 leading-relaxed">
            Your API key is sent directly to the backend for each request and never
            logged or persisted server-side.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-alt"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl bg-white text-black hover:bg-white/85 font-medium px-5"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

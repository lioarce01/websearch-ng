"use client";

import { useState, useEffect } from "react";

export interface LLMConfig {
  provider: string;
  apiKey: string;
  fastModel: string;
  mainModel: string;
  rememberKey: boolean; // if true, key stored in localStorage; else sessionStorage only
  maxSources: number;   // how many sources to include in synthesis
  contentCap: number;   // chars of content to keep per source
}

export interface ProviderDef {
  label: string;
  fastModel: string;
  mainModel: string;
  keyPlaceholder: string;
  keyDocsUrl: string;
  maxSources: number;
  contentCap: number;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  groq: {
    label: "Groq",
    fastModel: "groq/llama-3.1-8b-instant",
    mainModel: "groq/llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_...",
    keyDocsUrl: "https://console.groq.com/keys",
    maxSources: 8,    // 12k TPM free-tier limit — conservative
    contentCap: 2000,
  },
  openai: {
    label: "OpenAI",
    fastModel: "gpt-4o-mini",
    mainModel: "gpt-4o",
    keyPlaceholder: "sk-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    maxSources: 15,
    contentCap: 4000,
  },
  anthropic: {
    label: "Anthropic",
    fastModel: "claude-haiku-4-5-20251001",
    mainModel: "claude-sonnet-4-6",
    keyPlaceholder: "sk-ant-...",
    keyDocsUrl: "https://console.anthropic.com/keys",
    maxSources: 20,   // 200k context window — go deep
    contentCap: 5000,
  },
  openrouter: {
    label: "OpenRouter",
    fastModel: "openrouter/meta-llama/llama-3.1-8b-instruct",
    mainModel: "openrouter/anthropic/claude-sonnet-4-6",
    keyPlaceholder: "sk-or-...",
    keyDocsUrl: "https://openrouter.ai/keys",
    maxSources: 15,
    contentCap: 4000,
  },
  ollama: {
    label: "Ollama (local)",
    fastModel: "ollama/llama3.2",
    mainModel: "ollama/llama3.2",
    keyPlaceholder: "No key needed",
    keyDocsUrl: "https://ollama.com",
    maxSources: 10,
    contentCap: 3000,
  },
};

// Keys for storage — non-sensitive settings in localStorage, api key handled separately
const SETTINGS_KEY = "search-engine-settings";   // provider, models, rememberKey
const API_KEY_LS   = "search-engine-api-key";    // localStorage (only when rememberKey=true)
const API_KEY_SS   = "search-engine-api-key-ss"; // sessionStorage (default)

const DEFAULT_CONFIG: LLMConfig = {
  provider:    "groq",
  apiKey:      "",
  fastModel:   PROVIDERS.groq.fastModel,
  mainModel:   PROVIDERS.groq.mainModel,
  rememberKey: false,
  maxSources:  PROVIDERS.groq.maxSources,
  contentCap:  PROVIDERS.groq.contentCap,
};

function loadConfig(): LLMConfig {
  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    const base = settings ? JSON.parse(settings) : {};

    // Prefer sessionStorage key; fall back to localStorage key if rememberKey was set
    const apiKey =
      sessionStorage.getItem(API_KEY_SS) ??
      (base.rememberKey ? localStorage.getItem(API_KEY_LS) ?? "" : "");

    return { ...DEFAULT_CONFIG, ...base, apiKey };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function persistConfig(next: LLMConfig) {
  try {
    // Non-sensitive settings always go to localStorage
    const { apiKey, ...rest } = next;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));

    // API key: sessionStorage always (so it's available across refreshes within the tab)
    sessionStorage.setItem(API_KEY_SS, apiKey);

    if (next.rememberKey) {
      // Also persist to localStorage so it survives tab close
      localStorage.setItem(API_KEY_LS, apiKey);
    } else {
      // Explicitly clear the persistent key if user doesn't want it remembered
      localStorage.removeItem(API_KEY_LS);
    }
  } catch {}
}

export function useSettings() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setLoaded(true);
  }, []);

  const save = (next: LLMConfig) => {
    setConfig(next);
    persistConfig(next);
  };

  return { config, save, loaded };
}

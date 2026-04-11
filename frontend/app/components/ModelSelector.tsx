"use client";

import { useState, useRef, useEffect } from "react";
import type { LLMConfig } from "../hooks/useSettings";

interface Pricing {
  type: "free" | "free_tier" | "paid" | "unknown";
  prompt?: string;
  completion?: string;
}

interface Model { id: string; label: string; pricing?: Pricing }

function PricingBadge({ pricing }: { pricing?: Pricing }) {
  if (!pricing) return null;

  if (pricing.type === "free") {
    return (
      <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-400/10
                       border border-emerald-400/25 rounded-full px-1.5 py-px leading-none">
        Free
      </span>
    );
  }
  if (pricing.type === "free_tier") {
    return (
      <span className="shrink-0 text-[10px] font-medium text-emerald-400/80 bg-emerald-400/8
                       border border-emerald-400/20 rounded-full px-1.5 py-px leading-none">
        Free tier
      </span>
    );
  }
  if (pricing.type === "paid" && pricing.prompt) {
    return (
      <span className="shrink-0 text-[10px] font-medium text-red-400/80 bg-red-400/8
                       border border-red-400/20 rounded-full px-1.5 py-px leading-none">
        {pricing.prompt}/1M
      </span>
    );
  }
  return null;
}

function shortLabel(modelId: string): string {
  const name = modelId.split("/").pop() ?? modelId;
  return name.length > 22 ? name.slice(0, 21) + "…" : name;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-white/60">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
         className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-foreground-muted/40">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

interface ModelSelectorProps {
  config: LLMConfig;
  onMainModelChange: (id: string) => void;
  dropdownPosition?: "up" | "down";
  disabled?: boolean;
}

export default function ModelSelector({ config, onMainModelChange, dropdownPosition = "down", disabled = false }: ModelSelectorProps) {
  const [open, setOpen]       = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [models, setModels]   = useState<Model[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched]   = useState(false);
  const ref        = useRef<HTMLDivElement>(null);
  const subTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setSubOpen(false); }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Reset when provider/key changes so models are re-fetched
  useEffect(() => {
    setFetched(false);
    setModels([]);
  }, [config.provider, config.apiKey]);

  const fetchModels = async () => {
    if (fetched || fetching) return;
    setFetching(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: config.provider, apiKey: config.apiKey }),
      });
      const data = await res.json();
      setModels(data.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setFetching(false);
      setFetched(true);
    }
  };

  const handleSubEnter = () => {
    if (subTimer.current) clearTimeout(subTimer.current);
    fetchModels();
    setSubOpen(true);
  };

  const handleSubLeave = () => {
    subTimer.current = setTimeout(() => setSubOpen(false), 120);
  };

  const handleSubContentEnter = () => {
    if (subTimer.current) clearTimeout(subTimer.current);
  };

  const selectModel = (id: string) => {
    onMainModelChange(id);
    setOpen(false);
    setSubOpen(false);
  };

  const positionClass = dropdownPosition === "up" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div className="relative" ref={ref}>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); if (open) setSubOpen(false); }}
        className="flex items-center gap-1 h-8 px-2 rounded-lg
                   text-[12px] text-foreground/50 hover:text-foreground/80
                   hover:bg-white/8 transition-colors duration-150 focus:outline-none max-w-[160px]"
      >
        <span className="truncate">{shortLabel(config.mainModel)}</span>
        <ChevronDownIcon open={open} />
      </button>

      {/* Main dropdown */}
      {open && (
        <div className={`absolute ${positionClass} right-0 w-52
                         rounded-xl border border-white/10 bg-surface
                         shadow-2xl shadow-black/70 z-50 animate-fade-in py-1.5`}>

          {/* Current model */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-[12px] text-foreground/80 truncate flex-1">
              {shortLabel(config.mainModel)}
            </span>
            <CheckIcon />
          </div>

          <div className="mx-3 border-t border-white/8 my-1" />

          {/* More models — hover flyout */}
          <div
            className="relative"
            onMouseEnter={handleSubEnter}
            onMouseLeave={handleSubLeave}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                         hover:bg-white/8 transition-colors duration-100"
            >
              <span className="text-[13px] text-foreground">More models</span>
              <ChevronRightIcon />
            </button>

            {/* Submenu */}
            {subOpen && (
              <div
                onMouseEnter={handleSubContentEnter}
                onMouseLeave={handleSubLeave}
                className="absolute top-0 left-full ml-1 w-64 max-h-64 overflow-y-auto
                           rounded-xl border border-white/10 bg-surface
                           shadow-2xl shadow-black/70 z-50 animate-fade-in py-1.5
                           [&::-webkit-scrollbar]:w-[3px]
                           [&::-webkit-scrollbar-track]:bg-transparent
                           [&::-webkit-scrollbar-thumb]:bg-white/15
                           [&::-webkit-scrollbar-thumb]:rounded-full
                           [&::-webkit-scrollbar-thumb:hover]:bg-white/30"
              >
                {fetching ? (
                  <div className="flex items-center gap-2 px-3 py-3">
                    <svg className="animate-spin h-3 w-3 text-foreground-muted" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-[12px] text-foreground-muted">Loading models…</span>
                  </div>
                ) : models.length === 0 ? (
                  <p className="text-[12px] text-foreground-muted/50 px-3 py-3">
                    No models found. Check your API key in settings.
                  </p>
                ) : (
                  models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectModel(m.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5
                                 hover:bg-white/8 transition-colors duration-100"
                    >
                      <span className="text-[12px] text-foreground truncate flex-1 text-left">{m.label}</span>
                      <PricingBadge pricing={m.pricing} />
                      {m.id === config.mainModel && <CheckIcon />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

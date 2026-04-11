"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import SourcesModal from "./SourcesModal";
import ModelSelector from "./ModelSelector";
import type { LLMConfig } from "../hooks/useSettings";

export type SearchMode = "search" | "research";

const TIME_RANGES = [
  { value: "",      label: "Anytime"    },
  { value: "day",   label: "Past day"   },
  { value: "week",  label: "Past week"  },
  { value: "month", label: "Past month" },
  { value: "year",  label: "Past year"  },
];

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
  autoFocusOnMount?: boolean;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  timeRange: string;
  onTimeRangeChange: (r: string) => void;
  includeDomains: string[];
  onIncludeDomainsChange: (domains: string[]) => void;
  dropdownPosition?: "up" | "down";
  config: LLMConfig;
  onMainModelChange: (id: string) => void;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ResearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default function SearchBar({
  onSearch,
  loading,
  autoFocusOnMount = true,
  mode,
  onModeChange,
  timeRange,
  onTimeRangeChange,
  includeDomains,
  onIncludeDomainsChange,
  dropdownPosition = "down",
  config,
  onMainModelChange,
}: SearchBarProps) {
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const [open, setOpen]               = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const isResearch   = mode === "research";
  const hasTimeRange = timeRange !== "";
  const hasDomains   = includeDomains.length > 0;

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const submitQuery = () => {
    const query = inputRef.current?.value.trim();
    if (query) {
      onSearch(query);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitQuery();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  };

  return (
    <>
      <SourcesModal
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        domains={includeDomains}
        onDomainsChange={onIncludeDomainsChange}
      />

      <div
        className="flex flex-col rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl
                   shadow-2xl shadow-black/50 overflow-visible
                   focus-within:border-white/25 transition-all duration-300"
      >
        <form onSubmit={handleSubmit} className="flex flex-col w-full">

          {/* Input row */}
          <textarea
            ref={inputRef}
            name="q"
            rows={1}
            placeholder="Ask anything..."
            disabled={loading}
            autoFocus={autoFocusOnMount}
            onInput={resizeTextarea}
            onKeyDown={handleKeyDown}
            className="w-full resize-none overflow-y-auto bg-transparent text-foreground
                       placeholder:text-foreground-muted text-[15px] px-5 py-3.5 font-normal
                       leading-relaxed rounded-none border-0 outline-none focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed max-h-40"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">

            {/* Left controls */}
            <div className="flex items-center gap-1">

              {/* + options dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen((v) => !v)}
                  aria-label="Search options"
                  className="relative w-8 h-8 rounded-lg flex items-center justify-center
                             text-foreground-muted/60 hover:text-foreground-muted
                             hover:bg-white/8 transition-colors duration-150 focus:outline-none"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {(isResearch || hasTimeRange) && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                </button>

                {/* Dropdown — mode + time only */}
                {open && (
                  <div
                    className={`absolute ${dropdownPosition === "up" ? "bottom-full mb-2" : "top-full mt-2"} left-0 w-52
                               rounded-xl border border-white/10 bg-[#1c1c1c]
                               shadow-2xl shadow-black/70 z-50 animate-fade-in`}
                  >
                    {/* Mode */}
                    <div className="px-3 pt-2.5 pb-1">
                      <span className="text-[10px] font-medium text-foreground-muted/40 uppercase tracking-widest">
                        Mode
                      </span>
                    </div>
                    <div className="px-1 pb-1">
                      <button
                        type="button"
                        onClick={() => { onModeChange(isResearch ? "search" : "research"); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                   hover:bg-white/8 transition-colors duration-100"
                      >
                        <span className="text-foreground-muted"><ResearchIcon /></span>
                        <span className="flex-1 text-left text-[13px] text-foreground">Deep Research</span>
                        {isResearch && <span className="text-white/60"><CheckIcon /></span>}
                      </button>
                    </div>

                    {/* Time */}
                    <div className="mx-3 border-t border-white/8 my-1" />
                    <div className="px-3 pt-1.5 pb-1">
                      <span className="text-[10px] font-medium text-foreground-muted/40 uppercase tracking-widest">
                        Time
                      </span>
                    </div>
                    <div className="px-1 pb-2">
                      {TIME_RANGES.map((tr) => (
                        <button
                          key={tr.value}
                          type="button"
                          onClick={() => { onTimeRangeChange(tr.value); setOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg
                                     hover:bg-white/8 transition-colors duration-100"
                        >
                          <span className="text-[13px] text-foreground">{tr.label}</span>
                          {timeRange === tr.value && <span className="text-white/60"><CheckIcon /></span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sources button */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setSourcesOpen(true)}
                aria-label="Search sources"
                className="relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg
                           text-foreground-muted/60 hover:text-foreground-muted
                           hover:bg-white/8 transition-colors duration-150 focus:outline-none"
              >
                <GlobeIcon />
                <span className="text-[12px]">Sources</span>
                {hasDomains && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full
                                   bg-white/15 text-[10px] font-medium text-foreground/80">
                    {includeDomains.length}
                  </span>
                )}
              </button>

            </div>

            {/* Right controls: model selector + search */}
            <div className="flex items-center gap-2">
              <ModelSelector
                config={config}
                onMainModelChange={onMainModelChange}
                dropdownPosition={dropdownPosition}
                disabled={loading}
              />

            {/* Search button */}
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-8 px-4 bg-white text-background text-sm font-semibold
                         hover:bg-white/85 disabled:opacity-40 transition-all duration-200
                         flex items-center justify-center min-w-[68px]"
            >
              {loading ? <Spinner /> : "Search"}
            </Button>
            </div>

          </div>
        </form>
      </div>
    </>
  );
}

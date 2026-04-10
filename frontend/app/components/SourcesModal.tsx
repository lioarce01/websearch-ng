"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface SourcesModalProps {
  open: boolean;
  onClose: () => void;
  domains: string[];
  onDomainsChange: (domains: string[]) => void;
}

function parseDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/\/$/, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export default function SourcesModal({ open, onClose, domains, onDomainsChange }: SourcesModalProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const add = () => {
    const domain = parseDomain(input);
    if (!domain || domains.includes(domain)) { setInput(""); return; }
    onDomainsChange([...domains, domain]);
    setInput("");
    inputRef.current?.focus();
  };

  const remove = (d: string) => onDomainsChange(domains.filter((x) => x !== d));

  const clearAll = () => onDomainsChange([]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-sm bg-surface border border-white/10 text-foreground rounded-2xl
                   shadow-2xl shadow-black/60 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Search Sources
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground-muted mt-1">
              Restrict results to specific domains. Leave empty to search everywhere.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="e.g. reddit.com"
              className="flex-1 bg-surface-alt border border-white/10 rounded-xl px-3 py-2
                         text-[13px] text-foreground placeholder:text-foreground-muted/50
                         focus:outline-none focus:border-white/25 transition-colors"
            />
            <button
              type="button"
              onClick={add}
              disabled={!input.trim()}
              className="text-[12px] font-medium text-background bg-white hover:bg-white/85
                         rounded-xl px-3 py-2 transition-colors disabled:opacity-30"
            >
              Add
            </button>
          </div>

          {/* Active domains */}
          {domains.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-foreground-muted/40 uppercase tracking-widest">
                  Active ({domains.length})
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] text-foreground-muted/40 hover:text-foreground-muted transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {domains.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 text-[12px] text-foreground/80
                               bg-white/6 border border-white/10 rounded-full px-3 py-1"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => remove(d)}
                      aria-label={`Remove ${d}`}
                      className="text-foreground-muted/40 hover:text-foreground transition-colors leading-none"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-foreground-muted/40 text-center py-2">
              No sources added — searching everywhere
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-background bg-white hover:bg-white/85
                       rounded-xl px-5 py-2 transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

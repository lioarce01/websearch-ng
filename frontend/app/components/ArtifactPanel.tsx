"use client";

import { useState } from "react";
import {
  type Source,
  AnswerBody,
  ExportDropdown,
  CopyIcon,
  CheckIcon,
  buildMarkdown,
} from "./answer-shared";

interface ArtifactPanelProps {
  answer: string;
  loading: boolean;
  sources: Source[];
  query: string;
  onClose?: () => void;
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export default function ArtifactPanel({ answer, loading, sources, query, onClose }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildMarkdown(query, answer, sources));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmpty = !loading && !answer;

  return (
    <div className="h-full flex flex-col bg-surface/20">

      {/* Sticky header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8 shrink-0">
        <span className="text-foreground-muted/50">
          <DocumentIcon />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground-muted/50 uppercase tracking-widest leading-none mb-0.5">
            Research Report
          </p>
          {query && (
            <p className="text-[13px] text-foreground/70 truncate leading-snug">{query}</p>
          )}
        </div>

        {/* Actions — only when there's content */}
        {(answer || loading) && (
          <div className="flex items-center gap-3 shrink-0">
            {/* Copy as markdown */}
            <button
              onClick={handleCopy}
              disabled={!answer}
              className="flex items-center gap-1.5 text-[11px] text-foreground-muted/50
                         hover:text-foreground-muted transition-colors duration-150 cursor-pointer
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copied ? <><CheckIcon />Copied</> : <><CopyIcon />Copy</>}
            </button>

            <ExportDropdown query={query} answer={answer} sources={sources} disabled={!answer} />
          </div>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center
                       text-foreground-muted/40 hover:text-foreground-muted hover:bg-white/8
                       transition-all duration-150 cursor-pointer ml-1"
            aria-label="Close panel"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable document body */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-foreground-muted/30">
              <DocumentIcon />
            </div>
            <p className="text-[13px] text-foreground-muted/40 leading-relaxed">
              Research reports will appear here
            </p>
          </div>
        ) : (
          <div className="px-7 py-6 text-[15px]">
            {/* Loading skeleton */}
            {loading && !answer && (
              <div className="space-y-3 animate-pulse">
                {[80, 60, 90, 45, 70, 55, 85].map((w, i) => (
                  <div key={i} className="h-3 rounded-full bg-white/8" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Rendered markdown */}
            {answer && <AnswerBody answer={answer} loading={loading} sources={sources} />}
          </div>
        )}
      </div>
    </div>
  );
}

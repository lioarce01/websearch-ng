"use client";

import { useState } from "react";
import { type CodeBlock, CheckIcon, CopyIcon } from "./answer-shared";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ─── Copy button (self-contained state) ──────────────────────────────────────

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 text-[11px] text-foreground-muted/50
                 hover:text-foreground-muted transition-colors duration-150 cursor-pointer"
    >
      {copied ? <><CheckIcon />Copied</> : <><CopyIcon />Copy</>}
    </button>
  );
}

// ─── Code with line numbers ───────────────────────────────────────────────────

function CodeWithLineNumbers({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="flex min-w-0 font-mono text-[13px] leading-[1.65]">
      {/* Line numbers */}
      <div
        className="select-none shrink-0 text-right pr-4 text-foreground-muted/25
                   border-r border-white/6 min-w-[3rem]"
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      {/* Code */}
      <pre className="flex-1 overflow-x-auto pl-5 text-foreground/88 m-0 bg-transparent whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface CodeArtifactPanelProps {
  blocks:   CodeBlock[];
  onClose?: () => void;
}

export default function CodeArtifactPanel({ blocks, onClose }: CodeArtifactPanelProps) {
  const [activeTab, setActiveTab] = useState(0);

  const safeTab  = Math.min(activeTab, Math.max(0, blocks.length - 1));
  const active   = blocks[safeTab];

  const isEmpty  = blocks.length === 0;
  const lineCount = active ? active.code.split("\n").length : 0;

  return (
    <div className="h-full flex flex-col bg-surface/20">

      {/* ── Sticky header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8 shrink-0">
        <span className="text-foreground-muted/50">
          <CodeIcon />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground-muted/50 uppercase tracking-widest leading-none mb-1">
            Code
          </p>

          {/* Tab bar — shown only when multiple blocks */}
          {blocks.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {blocks.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors duration-100 ${
                    safeTab === i
                      ? "bg-white/15 text-foreground"
                      : "text-foreground-muted/40 hover:text-foreground-muted hover:bg-white/8"
                  }`}
                >
                  {b.lang}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isEmpty && (
          <div className="flex items-center gap-3 shrink-0">
            <CopyButton code={active.code} />
          </div>
        )}

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center
                       text-foreground-muted/40 hover:text-foreground-muted hover:bg-white/8
                       transition-all duration-150 cursor-pointer ml-1"
            aria-label="Close panel"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-foreground-muted/30">
              <CodeIcon />
            </div>
            <p className="text-[13px] text-foreground-muted/40 leading-relaxed">
              Code blocks will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Meta bar: language + line count */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/6">
              <span className="text-[11px] font-mono text-foreground-muted/40 uppercase tracking-widest">
                {active.lang}
              </span>
              <span className="text-[11px] text-foreground-muted/25">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            </div>

            {/* Code */}
            <div className="py-5">
              <CodeWithLineNumbers code={active.code} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

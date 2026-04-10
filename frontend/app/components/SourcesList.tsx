"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";

interface Source {
  index: number;
  title: string;
  url: string;
  content: string;
  score: number;
}

const INITIAL_VISIBLE = 4;

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
}

function getFavicon(url: string) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
  catch { return ""; }
}

export default function SourcesList({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  const hasMore     = sources.length > INITIAL_VISIBLE;
  const visible     = expanded ? sources : sources.slice(0, INITIAL_VISIBLE);
  const hiddenCount = sources.length - INITIAL_VISIBLE;

  return (
    <div className="w-full space-y-3 animate-fade-in-up">
      <Separator className="bg-white/8" />
      <p className="text-[11px] tracking-widest uppercase text-foreground-muted font-medium">Sources</p>

      <div className="relative">
        <div className="grid grid-cols-2 gap-2">
          {visible.map((source, i) => (
            <a
              key={source.index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2.5 p-2.5 rounded-xl border border-white/8
                         bg-surface hover:bg-surface-alt hover:border-white/15
                         transition-all duration-200 opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 55}ms`, animationFillMode: "forwards" }}
            >
              <div className="shrink-0 w-5 h-5 rounded-md overflow-hidden bg-white/8 flex items-center justify-center mt-0.5">
                <img
                  src={getFavicon(source.url)}
                  alt=""
                  width={14}
                  height={14}
                  className="object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground/75 truncate group-hover:text-foreground transition-colors leading-snug">
                  {source.title}
                </p>
                <p className="text-[10px] text-foreground-muted truncate mt-0.5">{getDomain(source.url)}</p>
              </div>

              <span className="shrink-0 text-[10px] font-mono text-plex/50 leading-none mt-0.5">
                {source.index}
              </span>
            </a>
          ))}
        </div>

        {/* Fade overlay when collapsed */}
        {hasMore && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16
                          bg-gradient-to-t from-background to-transparent
                          pointer-events-none" />
        )}
      </div>

      {/* Toggle button */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-foreground-muted hover:text-foreground
                     transition-colors duration-150 flex items-center gap-1.5"
        >
          {expanded ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m18 15-6-6-6 6"/></svg>
              Show less
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
              {hiddenCount} more source{hiddenCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}

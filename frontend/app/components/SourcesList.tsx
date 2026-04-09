"use client";

import { Separator } from "@/components/ui/separator";

interface Source {
  index: number;
  title: string;
  url: string;
  content: string;
  score: number;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <div className="w-full space-y-3">
      <Separator className="bg-white/10" />
      <p className="text-xs tracking-widest uppercase text-white/30">Sources</p>
      <div className="grid grid-cols-2 gap-2">
        {sources.map((source) => (
          <a
            key={source.index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/10
                       bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 text-white/50
                             text-[10px] font-mono flex items-center justify-center">
              {source.index}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-white/80 truncate group-hover:text-white transition-colors">
                {source.title}
              </p>
              <p className="text-[10px] text-white/30 truncate mt-0.5">{getDomain(source.url)}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

"use client";

export type Stage = "rewriting" | "searching" | "extracting" | "ranking" | "analyzing" | "generating" | "done";

const STAGE_LABEL: Record<Stage, string> = {
  rewriting:  "Rewriting query",
  searching:  "Searching the web",
  extracting: "Extracting content",
  ranking:    "Ranking results",
  analyzing:  "Analyzing gaps",
  generating: "Generating answer",
  done:       "",
};

export default function PipelineStatus({ current }: { current: Stage }) {
  if (current === "done") return null;

  return (
    // key forces a re-mount (and re-animation) on every stage change
    <div key={current} className="flex items-center gap-2.5 animate-fade-in">
      {/* Pulsing dot */}
      <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
        <span className="absolute inline-flex w-full h-full rounded-full bg-white/30 animate-ping" />
        <span className="relative w-1.5 h-1.5 rounded-full bg-white/70" />
      </span>

      {/* Label */}
      <span className="text-[13px] text-foreground-muted font-medium tracking-tight">
        {STAGE_LABEL[current]}
        <span className="animate-ellipsis inline-flex">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </span>
      </span>
    </div>
  );
}

"use client";

export type Stage = "rewriting" | "searching" | "extracting" | "ranking" | "generating" | "done";

const STAGES: { id: Stage; label: string }[] = [
  { id: "rewriting",  label: "Rewriting"  },
  { id: "searching",  label: "Searching"  },
  { id: "extracting", label: "Extracting" },
  { id: "ranking",    label: "Ranking"    },
  { id: "generating", label: "Writing"    },
];

const ORDER: Stage[] = ["rewriting", "searching", "extracting", "ranking", "generating", "done"];

function stageIndex(s: Stage) { return ORDER.indexOf(s); }

export default function PipelineStatus({ current }: { current: Stage }) {
  const currentIdx = stageIndex(current);

  return (
    <div className="flex items-center gap-2 flex-wrap animate-fade-in">
      {STAGES.map((stage, i) => {
        const idx = stageIndex(stage.id);
        const isComplete = idx < currentIdx || current === "done";
        const isActive   = idx === currentIdx && current !== "done";

        return (
          <div key={stage.id} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {/* Dot */}
              <span className="relative flex items-center justify-center w-1.5 h-1.5">
                {isActive && (
                  <span className="absolute inline-flex w-full h-full rounded-full bg-plex opacity-70 animate-ping" />
                )}
                <span className={`relative w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  isComplete ? "bg-plex/60" : isActive ? "bg-plex" : "bg-white/15"
                }`} />
              </span>
              {/* Label */}
              <span className={`text-xs transition-colors duration-300 ${
                isComplete ? "text-foreground-muted/50"
                : isActive  ? "text-plex font-medium"
                : "text-white/20"
              }`}>
                {stage.label}
              </span>
            </div>

            {i < STAGES.length - 1 && (
              <span className={`w-3 h-px transition-colors duration-500 ${
                isComplete ? "bg-plex/30" : "bg-white/10"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

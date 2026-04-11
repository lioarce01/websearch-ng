"use client";

import { useState, useRef, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import AnswerSkeleton from "./AnswerSkeleton";
import {
  type Source,
  AnswerBody,
  ExportDropdown,
  CopyIcon,
  CheckIcon,
  RetryIcon,
} from "./answer-shared";

interface AnswerStreamProps {
  status: string;
  answer: string;
  loading: boolean;
  sources: Source[];
  query?: string;
  mode?: string;
  onRetry?: () => void;
}

export default function AnswerStream({ status, answer, loading, sources, query = "", mode, onRetry }: AnswerStreamProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  if (!loading && !answer) return null;

  return (
    <div className="w-full space-y-4 animate-fade-in-up">
      <Separator className="bg-white/8" />

      {/* Skeleton while waiting for first token */}
      {loading && !answer && <AnswerSkeleton />}

      {/* Streamed answer */}
      {answer && <AnswerBody answer={answer} loading={loading} sources={sources} />}

      {/* Footer — copy + export, only when answer is complete */}
      {!loading && answer && (
        <div className="flex justify-end items-center gap-3 pt-1">

          {/* Retry — re-run the full pipeline for this query */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 text-[11px] text-foreground-muted/50
                         hover:text-foreground-muted transition-colors duration-150 cursor-pointer"
            >
              <RetryIcon />Retry
            </button>
          )}

          {/* Copy raw answer text */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(answer);
              setCopiedAnswer(true);
              setTimeout(() => setCopiedAnswer(false), 2000);
            }}
            className="flex items-center gap-1.5 text-[11px] text-foreground-muted/50
                       hover:text-foreground-muted transition-colors duration-150 cursor-pointer"
          >
            {copiedAnswer ? <><CheckIcon />Copied</> : <><CopyIcon />Copy</>}
          </button>

          {/* Export — research mode only */}
          {mode === "research" && (
            <ExportDropdown query={query} answer={answer} sources={sources} />
          )}
        </div>
      )}
    </div>
  );
}

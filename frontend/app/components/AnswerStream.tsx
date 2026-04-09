"use client";

import ReactMarkdown from "react-markdown";
import { Separator } from "@/components/ui/separator";

interface AnswerStreamProps {
  status: string;
  answer: string;
  loading: boolean;
}

export default function AnswerStream({ status, answer, loading }: AnswerStreamProps) {
  if (!loading && !answer) return null;

  return (
    <div className="w-full space-y-4">
      <Separator className="bg-white/10" />

      {loading && !answer && (
        <p className="text-xs text-white/30 tracking-widest uppercase animate-pulse">{status}</p>
      )}

      {answer && (
        <div className="prose prose-sm prose-invert max-w-none leading-relaxed
                        prose-headings:font-semibold prose-headings:text-white
                        prose-a:text-white prose-a:underline prose-a:underline-offset-2
                        prose-strong:text-white
                        prose-code:text-white prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                        prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg">
          <ReactMarkdown>{answer}</ReactMarkdown>
          {loading && (
            <span className="inline-block w-px h-3.5 bg-white/70 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

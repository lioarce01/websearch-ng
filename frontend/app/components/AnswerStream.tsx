"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Separator } from "@/components/ui/separator";
import AnswerSkeleton from "./AnswerSkeleton";

interface Source {
  index: number;
  title: string;
  url: string;
}

interface AnswerStreamProps {
  status: string;
  answer: string;
  loading: boolean;
  sources: Source[];
}

/** Inline citation badge [N] → styled clickable link */
function renderCitations(text: string, sources: Source[]) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;
    const idx = parseInt(match[1]);
    const source = sources.find((s) => s.index === idx);
    return (
      <a
        key={i}
        href={source?.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        title={source?.title}
        className="inline-flex items-center justify-center mx-0.5 w-4 h-4 text-[10px]
                   font-mono font-semibold rounded-full bg-plex/15 text-plex
                   hover:bg-plex/30 transition-colors cursor-pointer
                   border border-plex/25 hover:border-plex/50 no-underline
                   leading-none align-middle relative -top-px"
      >
        {idx}
      </a>
    );
  });
}

/** Process children nodes to replace [N] text with citation badges */
function withCitations(sources: Source[]) {
  const process = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") return renderCitations(children, sources);
    if (Array.isArray(children)) {
      return children.flatMap((child, i) =>
        typeof child === "string"
          ? renderCitations(child, sources).map((el, j) =>
              typeof el === "string" ? el : { ...el, key: `${i}-${j}` }
            )
          : [child]
      );
    }
    return children;
  };
  return process;
}

/** Code block with copy button */
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") ?? "";
  const code = typeof children === "string" ? children : "";

  const copy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-white/8 bg-surface">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-surface-alt">
        <span className="text-[11px] font-mono text-foreground-muted">{lang || "code"}</span>
        <button
          onClick={copy}
          className="text-[11px] font-medium text-foreground-muted hover:text-foreground
                     transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <><CheckIcon />Copied</>
          ) : (
            <><CopyIcon />Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono text-foreground/90 m-0 bg-transparent">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Build all custom react-markdown components */
function makeComponents(sources: Source[]) {
  const pc = withCitations(sources);

  return {
    // Paragraphs with citation processing
    p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
      <p className="mb-4 last:mb-0 leading-7 text-foreground/85">{pc(children)}</p>
    ),

    // Headings
    h1: ({ children }: React.ComponentPropsWithoutRef<"h1">) => (
      <h1 className="text-xl font-semibold text-foreground mt-6 mb-3">{pc(children)}</h1>
    ),
    h2: ({ children }: React.ComponentPropsWithoutRef<"h2">) => (
      <h2 className="text-lg font-semibold text-foreground mt-5 mb-2.5">{pc(children)}</h2>
    ),
    h3: ({ children }: React.ComponentPropsWithoutRef<"h3">) => (
      <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{pc(children)}</h3>
    ),

    // Lists
    ul: ({ children }: React.ComponentPropsWithoutRef<"ul">) => (
      <ul className="my-3 ml-5 space-y-1.5 list-disc marker:text-plex/60">{children}</ul>
    ),
    ol: ({ children }: React.ComponentPropsWithoutRef<"ol">) => (
      <ol className="my-3 ml-5 space-y-1.5 list-decimal marker:text-plex/60">{children}</ol>
    ),
    li: ({ children }: React.ComponentPropsWithoutRef<"li">) => (
      <li className="text-foreground/85 leading-6 pl-1">{pc(children)}</li>
    ),

    // Inline text
    strong: ({ children }: React.ComponentPropsWithoutRef<"strong">) => (
      <strong className="font-semibold text-foreground">{pc(children)}</strong>
    ),
    em: ({ children }: React.ComponentPropsWithoutRef<"em">) => (
      <em className="italic text-foreground/80">{children}</em>
    ),

    // Links
    a: ({ href, children }: React.ComponentPropsWithoutRef<"a">) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="text-plex hover:text-plex-dim underline underline-offset-2 decoration-plex/40 transition-colors">
        {children}
      </a>
    ),

    // Inline code
    code: ({ children, className }: React.ComponentPropsWithoutRef<"code">) => {
      if (className?.startsWith("language-")) return <code className={className}>{children}</code>;
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-plex/10 text-plex text-[13px] font-mono border border-plex/15">
          {children}
        </code>
      );
    },

    // Code blocks
    pre: ({ children }: React.ComponentPropsWithoutRef<"pre">) => {
      const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      return (
        <CodeBlock className={child?.props?.className}>
          {child?.props?.children}
        </CodeBlock>
      );
    },

    // Blockquote
    blockquote: ({ children }: React.ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote className="my-4 pl-4 border-l-2 border-plex/50 text-foreground/60 italic">
        {children}
      </blockquote>
    ),

    // Horizontal rule
    hr: () => <hr className="my-5 border-white/10" />,

    // Tables (GFM)
    table: ({ children }: React.ComponentPropsWithoutRef<"table">) => (
      <div className="my-4 overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }: React.ComponentPropsWithoutRef<"thead">) => (
      <thead className="bg-surface-alt text-foreground/60 text-xs uppercase tracking-wider">{children}</thead>
    ),
    tbody: ({ children }: React.ComponentPropsWithoutRef<"tbody">) => (
      <tbody className="divide-y divide-white/6">{children}</tbody>
    ),
    tr: ({ children }: React.ComponentPropsWithoutRef<"tr">) => (
      <tr className="hover:bg-white/3 transition-colors">{children}</tr>
    ),
    th: ({ children }: React.ComponentPropsWithoutRef<"th">) => (
      <th className="px-4 py-2.5 text-left font-medium">{children}</th>
    ),
    td: ({ children }: React.ComponentPropsWithoutRef<"td">) => (
      <td className="px-4 py-2.5 text-foreground/80">{pc(children as React.ReactNode)}</td>
    ),
  };
}

export default function AnswerStream({ status, answer, loading, sources }: AnswerStreamProps) {
  if (!loading && !answer) return null;

  return (
    <div className="w-full space-y-4 animate-fade-in-up">
      <Separator className="bg-white/8" />

      {/* Skeleton while waiting for first token */}
      {loading && !answer && <AnswerSkeleton />}

      {/* Streamed answer */}
      {answer && (
        <div className="text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={makeComponents(sources)}
          >
            {answer}
          </ReactMarkdown>
          {loading && (
            <span className="inline-block w-0.5 h-4 bg-plex animate-pulse ml-0.5 align-middle rounded-full" />
          )}
        </div>
      )}
    </div>
  );
}

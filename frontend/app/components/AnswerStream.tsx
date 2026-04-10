"use client";

import { useState, useRef, useEffect } from "react";
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
  query?: string;
}

type ExportFormat = { label: string; ext: string; mime: string };

const EXPORT_FORMATS: ExportFormat[] = [
  { label: "Markdown",   ext: "md",  mime: "text/markdown;charset=utf-8" },
  { label: "Plain text", ext: "txt", mime: "text/plain;charset=utf-8"    },
];

function buildMarkdown(query: string, answer: string, sources: Source[]): string {
  const sourcesList = sources.map((s) => `${s.index}. [${s.title}](${s.url})`).join("\n");
  return [`# ${query}`, "", answer, "", "---", "", "## Sources", "", sourcesList].join("\n");
}

function buildPlainText(query: string, answer: string, sources: Source[]): string {
  const stripped = answer.replace(/\[(\d+)\]/g, "[$1]").replace(/[#*`_~>]/g, "").replace(/\n{3,}/g, "\n\n");
  const sourcesList = sources.map((s) => `[${s.index}] ${s.title} — ${s.url}`).join("\n");
  return [`${query}`, "", "=".repeat(query.length), "", stripped, "", "Sources", "-------", sourcesList].join("\n");
}

function getContent(fmt: ExportFormat, query: string, answer: string, sources: Source[]): string {
  if (fmt.ext === "txt") return buildPlainText(query, answer, sources);
  return buildMarkdown(query, answer, sources);
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
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
                   font-mono font-semibold rounded-full bg-white/10 text-foreground-muted
                   hover:bg-white/20 hover:text-foreground transition-colors cursor-pointer
                   border border-white/15 hover:border-white/30 no-underline
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
      <ul className="my-3 ml-5 space-y-1.5 list-disc marker:text-foreground-muted/60">{children}</ul>
    ),
    ol: ({ children }: React.ComponentPropsWithoutRef<"ol">) => (
      <ol className="my-3 ml-5 space-y-1.5 list-decimal marker:text-foreground-muted/60">{children}</ol>
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
         className="text-foreground/70 hover:text-foreground underline underline-offset-2 decoration-white/20 hover:decoration-white/40 transition-colors">
        {children}
      </a>
    ),

    // Inline code
    code: ({ children, className }: React.ComponentPropsWithoutRef<"code">) => {
      if (className?.startsWith("language-")) return <code className={className}>{children}</code>;
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-white/8 text-foreground/80 text-[13px] font-mono border border-white/10">
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
      <blockquote className="my-4 pl-4 border-l-2 border-white/20 text-foreground/60 italic">
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

export default function AnswerStream({ status, answer, loading, sources, query = "" }: AnswerStreamProps) {
  const [exportOpen, setExportOpen]   = useState(false);
  const [downloaded, setDownloaded]   = useState(false);
  const exportRef                     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExportOpen(false); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onMouseDown); document.removeEventListener("keydown", onKey); };
  }, []);

  if (!loading && !answer) return null;

  const handleExport = (fmt: ExportFormat) => {
    const content = getContent(fmt, query, answer, sources);
    const blob = new Blob([content], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(query || "research").slice(0, 60).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

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
            <span className="inline-block w-0.5 h-4 bg-foreground-muted animate-pulse ml-0.5 align-middle rounded-full" />
          )}
        </div>
      )}

      {/* Export dropdown — only when answer is complete */}
      {!loading && answer && (
        <div className="flex justify-end pt-1">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-foreground-muted/50
                         hover:text-foreground-muted transition-colors duration-150 cursor-pointer"
            >
              <DownloadIcon />
              {downloaded ? "Downloaded" : "Export"}
              <ChevronIcon />
            </button>

            {exportOpen && (
              <div className="absolute top-full mt-2 right-0 w-40
                              rounded-xl border border-white/10 bg-[#1c1c1c]
                              shadow-2xl shadow-black/70 overflow-hidden z-50 animate-fade-in">
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[10px] font-medium text-foreground-muted/40 uppercase tracking-widest">
                    Export as
                  </span>
                </div>
                <div className="px-1 pb-1.5">
                  {EXPORT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.ext}
                      type="button"
                      onClick={() => handleExport(fmt)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg
                                 hover:bg-white/8 transition-colors duration-100 cursor-pointer"
                    >
                      <span className="text-[11px] font-mono text-foreground-muted/60 w-6">.{fmt.ext}</span>
                      <span className="text-[13px] text-foreground">{fmt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

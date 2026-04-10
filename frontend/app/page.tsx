"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import SearchBar, { type SearchMode } from "./components/SearchBar";
import AnswerStream from "./components/AnswerStream";
import SourcesList from "./components/SourcesList";
import PipelineStatus, { type Stage } from "./components/PipelineStatus";
import SettingsModal from "./components/SettingsModal";
import { useSettings, PROVIDERS } from "./hooks/useSettings";

interface Source {
  index: number;
  title: string;
  url: string;
  content: string;
  score: number;
}

interface Turn {
  query: string;
  answer: string;
  sources: Source[];
}

const CHARS_PER_FRAME = 2; // hyper-slow for testing — raise to 3-6 for production

const STATUS_TO_STAGE: Record<string, Stage> = {
  "Rewriting query...":    "rewriting",
  "Searching the web...":  "searching",
  "Extracting content...": "extracting",
  "Ranking results...":    "ranking",
  "Analyzing gaps...":     "analyzing",
  "Deep searching...":     "searching",
  "Generating answer...":  "generating",
};

export default function Home() {
  const { config, save: saveConfig } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchMode, setSearchMode]     = useState<SearchMode>("search");
  const [turns, setTurns]               = useState<Turn[]>([]);
  const [loading, setLoading]           = useState(false);
  const [stage, setStage]               = useState<Stage>("rewriting");
  const [currentQuery, setCurrentQuery] = useState("");
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [streamSources, setStreamSources]     = useState<Source[]>([]);

  const receivedRef     = useRef("");
  const displayedLenRef = useRef(0);
  const rafRef          = useRef<number | null>(null);
  const isDoneRef       = useRef(false);
  const finalSourcesRef = useRef<Source[]>([]);
  const currentQueryRef = useRef("");
  const scrollRef       = useRef<HTMLDivElement>(null);

  const hasConversation = turns.length > 0 || loading;

  const finalize = useCallback(() => {
    const finalAnswer = receivedRef.current;
    setTurns((prev) => [
      ...prev,
      { query: currentQueryRef.current, answer: finalAnswer, sources: finalSourcesRef.current },
    ]);
    setDisplayedAnswer("");
    setStreamSources([]);
    setLoading(false);
    setStage("done");
  }, []);

  const startSoftStream = useCallback(() => {
    const tick = () => {
      const total = receivedRef.current.length;
      if (displayedLenRef.current < total) {
        displayedLenRef.current = Math.min(displayedLenRef.current + CHARS_PER_FRAME, total);
        setDisplayedAnswer(receivedRef.current.slice(0, displayedLenRef.current));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (isDoneRef.current) { rafRef.current = null; finalize(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finalize]);

  const stopSoftStream = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayedAnswer, streamSources]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const handleSearch = async (query: string) => {
    receivedRef.current     = "";
    displayedLenRef.current = 0;
    isDoneRef.current       = false;
    finalSourcesRef.current = [];
    currentQueryRef.current = query;

    setLoading(true);
    setCurrentQuery(query);
    setDisplayedAnswer("");
    setStreamSources([]);
    setStage("rewriting");
    startSoftStream();

    const history = turns.map((t) => ({ query: t.query, answer: t.answer }));

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history, llm_config: config, mode: searchMode }),
      });
      if (!res.ok || !res.body) throw new Error("Search request failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.trim().split("\n");
          let event = "", data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7);
            if (line.startsWith("data: "))  data  = line.slice(6);
          }
          if (!event || !data) continue;
          const payload = JSON.parse(data);

          if (event === "status") { const s = STATUS_TO_STAGE[payload.message]; if (s) setStage(s); }
          if (event === "sources") { finalSourcesRef.current = payload.sources; setStreamSources(payload.sources); }
          if (event === "token")   { receivedRef.current += payload.text; }
          if (event === "done")    { isDoneRef.current = true; }
          if (event === "error")   { console.error("[search error]", payload.message); stopSoftStream(); setLoading(false); }
        }
      }
    } catch {
      stopSoftStream();
      setLoading(false);
    }
  };

  return (
    <main className="h-screen bg-background flex flex-col overflow-hidden">

      {/* Settings gear — always top-right */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        {/* Current provider badge */}
        <span className="text-[11px] text-foreground-muted font-mono hidden sm:block">
          {PROVIDERS[config.provider]?.label}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 rounded-xl flex items-center justify-center
                     text-foreground-muted hover:text-foreground hover:bg-surface-alt
                     transition-all duration-200"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={saveConfig}
      />

      {/* ── HERO STATE: centered search ── */}
      {!hasConversation && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            <div className="text-center space-y-2">
              <h1 className="text-[2.5rem] font-semibold tracking-tight text-foreground leading-none">
                Search
              </h1>
              <p className="text-[15px] text-foreground-muted">
                AI-powered answers with sources
              </p>
            </div>
            <div className="w-full animate-slide-up">
              <SearchBar
                onSearch={handleSearch}
                loading={loading}
                mode={searchMode}
                onModeChange={setSearchMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CONVERSATION STATE: scrollable area ── */}
      {hasConversation && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 pt-12 pb-52 flex flex-col gap-12">

            {/* Past turns */}
            {turns.map((turn, i) => (
              <div key={i} className="flex flex-col gap-5 animate-fade-in-up">
                <p className="text-[15px] font-medium text-foreground leading-relaxed">
                  {turn.query}
                </p>
                <SourcesList sources={turn.sources} />
                <AnswerStream answer={turn.answer} loading={false} status="" sources={turn.sources} query={turn.query} />
              </div>
            ))}

            {/* Current streaming turn */}
            {loading && (
              <div className="flex flex-col gap-5">
                <p className="text-[15px] font-medium text-foreground leading-relaxed animate-fade-in">
                  {currentQuery}
                </p>
                <PipelineStatus current={stage} />
                <SourcesList sources={streamSources} />
                <AnswerStream
                  answer={displayedAnswer}
                  loading={loading}
                  status={stage}
                  sources={streamSources}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FLOATING BOTTOM BAR (conversation mode only) ── */}
      {hasConversation && (
        <>
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none h-44
                          bg-gradient-to-t from-background via-background/85 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-7 px-4 pointer-events-none">
            <div className="w-full max-w-2xl pointer-events-auto animate-slide-up">
              <SearchBar
                onSearch={handleSearch}
                loading={loading}
                autoFocusOnMount={false}
                mode={searchMode}
                onModeChange={setSearchMode}
              />
            </div>
          </div>
        </>
      )}

    </main>
  );
}

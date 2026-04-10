"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import SearchBar, { type SearchMode } from "./components/SearchBar";
import AnswerStream from "./components/AnswerStream";
import SourcesList from "./components/SourcesList";
import PipelineStatus, { type Stage } from "./components/PipelineStatus";
import SettingsModal from "./components/SettingsModal";
import ArtifactPanel from "./components/ArtifactPanel";
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
  suggestions: string[];
  queries: string[];
}

const DOMAIN_GROUPS = [
  { label: "Academic", key: "academic", domains: ["arxiv.org", "scholar.google.com", "pubmed.ncbi.nlm.nih.gov", "semanticscholar.org"] },
  { label: "News",     key: "news",     domains: ["reuters.com", "apnews.com", "bbc.com", "theguardian.com"] },
  { label: "Tech",     key: "tech",     domains: ["github.com", "stackoverflow.com", "docs.python.org", "developer.mozilla.org"] },
  { label: "Reddit",   key: "reddit",   domains: ["reddit.com"] },
];

function QueryPills({ queries }: { queries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 -mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-foreground-muted/35 hover:text-foreground-muted/60 transition-colors cursor-pointer w-fit"
      >
        {queries.length} search {queries.length === 1 ? "query" : "queries"}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
             className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {queries.map((q, i) => (
            <span key={i} className="text-[11px] text-foreground-muted/50 border border-white/8 rounded-full px-2.5 py-0.5 bg-white/3">
              {q}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
  const [timeRange, setTimeRange]       = useState<string>("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [turns, setTurns]               = useState<Turn[]>([]);
  const [loading, setLoading]           = useState(false);
  const [stage, setStage]               = useState<Stage>("rewriting");
  const [currentQuery, setCurrentQuery] = useState("");
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [streamSources, setStreamSources]     = useState<Source[]>([]);

  const receivedRef       = useRef("");
  const displayedLenRef   = useRef(0);
  const rafRef            = useRef<number | null>(null);
  const isDoneRef         = useRef(false);
  const finalSourcesRef   = useRef<Source[]>([]);
  const currentQueryRef   = useRef("");
  const suggestionsRef    = useRef<string[]>([]);
  const queriesRef        = useRef<string[]>([]);
  const scrollRef         = useRef<HTMLDivElement>(null);

  // Resizable artifact panel
  const [artifactWidth, setArtifactWidth]       = useState(500);
  const [artifactOpen, setArtifactOpen]         = useState(false);
  const [artifactTurnIndex, setArtifactTurnIndex] = useState<number | null>(null);
  const isDraggingRef   = useRef(false);
  const dragStartXRef   = useRef(0);
  const dragStartWRef   = useRef(0);

  const hasConversation = turns.length > 0 || loading;
  const showArtifact    = searchMode === "research" && hasConversation && artifactOpen;

  // During loading: always show the active stream.
  // After loading: show the turn the user clicked (or latest by default).
  const selectedTurn    = loading ? null : (turns[artifactTurnIndex ?? turns.length - 1] ?? turns[turns.length - 1]);
  const artifactAnswer  = loading ? displayedAnswer : (selectedTurn?.answer  ?? "");
  const artifactSources = loading ? streamSources   : (selectedTurn?.sources ?? []);
  const artifactQuery   = loading ? currentQuery    : (selectedTurn?.query   ?? "");

  const openArtifact = (index: number) => {
    setArtifactTurnIndex(index);
    setArtifactOpen(true);
  };

  const finalize = useCallback(() => {
    const finalAnswer = receivedRef.current;
    setTurns((prev) => [
      ...prev,
      { query: currentQueryRef.current, answer: finalAnswer, sources: finalSourcesRef.current, suggestions: suggestionsRef.current, queries: queriesRef.current },
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

  // Session persistence — restore on mount
  useEffect(() => {
    try {
      const savedTurns = sessionStorage.getItem("ws_turns");
      const savedMode  = sessionStorage.getItem("ws_mode");
      if (savedTurns) setTurns(JSON.parse(savedTurns));
      if (savedMode === "research" || savedMode === "search") setSearchMode(savedMode);
    } catch { /* corrupt data — start fresh */ }
  }, []);

  // Session persistence — persist turns
  useEffect(() => {
    try { sessionStorage.setItem("ws_turns", JSON.stringify(turns)); } catch { /* quota exceeded */ }
  }, [turns]);

  // Session persistence — persist mode
  useEffect(() => {
    sessionStorage.setItem("ws_mode", searchMode);
  }, [searchMode]);

  // Drag-to-resize artifact panel
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - e.clientX; // dragging left → wider
      const next  = Math.max(320, Math.min(window.innerWidth * 0.65, dragStartWRef.current + delta));
      setArtifactWidth(next);
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current        = false;
      document.body.style.cursor      = "";
      document.body.style.userSelect  = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    isDraggingRef.current       = true;
    dragStartXRef.current       = e.clientX;
    dragStartWRef.current       = artifactWidth;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleSearch = async (query: string) => {
    receivedRef.current     = "";
    displayedLenRef.current = 0;
    isDoneRef.current       = false;
    finalSourcesRef.current = [];
    suggestionsRef.current  = [];
    queriesRef.current      = [];
    currentQueryRef.current = query;

    setLoading(true);
    setCurrentQuery(query);
    setDisplayedAnswer("");
    setStreamSources([]);
    setStage("rewriting");
    // Keep artifact open if already open (research); close if switching to normal search
    if (searchMode !== "research") setArtifactOpen(false);
    setArtifactTurnIndex(null); // always show the incoming stream
    startSoftStream();

    const history = turns.map((t) => ({ query: t.query, answer: t.answer }));

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          history,
          llm_config: config,
          mode: searchMode,
          time_range: timeRange,
          include_domains: DOMAIN_GROUPS.find(g => g.key === domainFilter)?.domains ?? [],
        }),
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

          if (event === "status")      { const s = STATUS_TO_STAGE[payload.message]; if (s) setStage(s); }
          if (event === "sources")     { finalSourcesRef.current = payload.sources; setStreamSources(payload.sources); }
          if (event === "token")       { receivedRef.current += payload.text; }
          if (event === "queries")     { queriesRef.current = payload.queries ?? []; }
          if (event === "suggestions") { suggestionsRef.current = payload.questions ?? []; }
          if (event === "done")        { isDoneRef.current = true; }
          if (event === "error")       { console.error("[search error]", payload.message); stopSoftStream(); setLoading(false); }
        }
      }
    } catch {
      stopSoftStream();
      setLoading(false);
    }
  };

  return (
    <main className="h-screen bg-background flex flex-col overflow-hidden">

      {/* ── TOP NAVBAR ── */}
      <header className="shrink-0 flex items-center justify-between px-4 h-11 border-b border-white/8 z-20">
        {/* Left: wordmark */}
        <span className="text-[13px] font-semibold tracking-tight text-foreground/60 select-none">
          Search
        </span>

        {/* Right: provider badge + settings */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground-muted/50 font-mono hidden sm:block">
            {PROVIDERS[config.provider]?.label}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center
                       text-foreground-muted hover:text-foreground hover:bg-surface-alt
                       transition-all duration-200"
            aria-label="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

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
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                domainFilter={domainFilter}
                onDomainFilterChange={setDomainFilter}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CONVERSATION STATE: split layout when artifact active ── */}
      {hasConversation && (
        <div className="flex-1 flex overflow-hidden">

          {/* Left: conversation timeline */}
          <div className="relative flex-1 flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className={`mx-auto px-6 pt-12 pb-52 flex flex-col gap-12 ${showArtifact ? "max-w-xl" : "max-w-2xl"}`}>

                {/* Past turns */}
                {turns.map((turn, i) => (
                  <div key={i} className="flex flex-col gap-5 animate-fade-in-up">
                    <div className="flex flex-col gap-2">
                      <p className="text-[15px] font-medium text-foreground leading-relaxed">
                        {turn.query}
                      </p>
                      {turn.queries?.length > 0 && <QueryPills queries={turn.queries} />}
                    </div>
                    <SourcesList sources={turn.sources} />

                    {/* In research mode: report-ready card instead of inline answer */}
                    {searchMode === "research" ? (
                      <button
                        type="button"
                        onClick={() => openArtifact(i)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left
                                   border border-white/8 bg-surface/40 hover:bg-surface/70
                                   hover:border-white/15 transition-all duration-150 cursor-pointer
                                   animate-fade-in-up"
                      >
                        <div className="shrink-0 w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-muted/60">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground/70">Research report generated</p>
                          <p className="text-[11px] text-foreground-muted/50 mt-0.5 truncate">
                            {turn.answer.replace(/[#*`_~>[\]]/g, "").trim().slice(0, 80)}…
                          </p>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-foreground-muted/30 shrink-0">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                    ) : (
                      <AnswerStream answer={turn.answer} loading={false} status="" sources={turn.sources} query={turn.query} mode={searchMode} />
                    )}

                    {searchMode !== "research" && turn.suggestions?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {turn.suggestions.map((q, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => handleSearch(q)}
                            className="text-[12px] text-foreground-muted border border-white/10
                                       rounded-full px-3 py-1.5 hover:bg-surface-alt hover:text-foreground
                                       hover:border-white/20 transition-all duration-150 text-left cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
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

                    {/* In research mode: live progress card pointing to artifact */}
                    {searchMode === "research" ? (
                      stage === "generating" && (
                        <button
                          type="button"
                          onClick={() => { setArtifactTurnIndex(null); setArtifactOpen(true); }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left
                                     border border-white/8 bg-surface/40 hover:bg-surface/70
                                     hover:border-white/15 transition-all duration-150 cursor-pointer
                                     animate-fade-in"
                        >
                          <div className="shrink-0 w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center">
                            <svg className="animate-spin h-3.5 w-3.5 text-foreground-muted/50" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground/70">Writing research report</p>
                            <p className="text-[11px] text-foreground-muted/50 mt-0.5">Streaming to the panel on the right</p>
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-foreground-muted/30 shrink-0">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </button>
                      )
                    ) : (
                      <AnswerStream
                        answer={displayedAnswer}
                        loading={loading}
                        status={stage}
                        sources={streamSources}
                        mode={searchMode}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Gradient + floating search bar — absolute within the left column */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none h-44 z-10
                            bg-gradient-to-t from-background via-background/85 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-7 px-4 pointer-events-none z-10">
              <div className={`w-full pointer-events-auto animate-slide-up ${showArtifact ? "max-w-xl" : "max-w-2xl"}`}>
                <SearchBar
                  onSearch={handleSearch}
                  loading={loading}
                  autoFocusOnMount={false}
                  mode={searchMode}
                  onModeChange={setSearchMode}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  domainFilter={domainFilter}
                  onDomainFilterChange={setDomainFilter}
                  dropdownPosition="up"
                />
              </div>
            </div>
          </div>

          {/* Drag handle + artifact panel (research mode only) */}
          {showArtifact && (
            <>
              {/* Drag handle */}
              <div
                onMouseDown={handleDragStart}
                className="w-1 shrink-0 bg-white/8 hover:bg-white/20 active:bg-white/30
                           cursor-col-resize transition-colors duration-150 relative group"
              >
                {/* Grip dots */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                flex flex-col gap-[3px] opacity-0 group-hover:opacity-100
                                transition-opacity duration-150">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="w-[3px] h-[3px] rounded-full bg-white/50" />
                  ))}
                </div>
              </div>

              {/* Artifact panel */}
              <div style={{ width: artifactWidth }} className="shrink-0 flex flex-col animate-fade-in">
                <ArtifactPanel
                  answer={artifactAnswer}
                  loading={loading}
                  sources={artifactSources}
                  query={artifactQuery}
                  onClose={() => setArtifactOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      )}

    </main>
  );
}

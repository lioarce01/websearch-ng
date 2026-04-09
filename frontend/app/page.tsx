"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import SearchBar from "./components/SearchBar";
import AnswerStream from "./components/AnswerStream";
import SourcesList from "./components/SourcesList";

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

const CHARS_PER_FRAME = 1; // display speed — increase for faster, decrease for slower

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [streamSources, setStreamSources] = useState<Source[]>([]);

  const receivedRef = useRef("");          // raw SSE buffer
  const displayedLenRef = useRef(0);       // how many chars shown so far
  const rafRef = useRef<number | null>(null);
  const isDoneRef = useRef(false);         // true once backend sends "done"
  const finalSourcesRef = useRef<Source[]>([]);
  const currentQueryRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const finalize = useCallback(() => {
    const finalAnswer = receivedRef.current;
    const query = currentQueryRef.current;
    const sources = finalSourcesRef.current;
    setTurns((prev) => [...prev, { query, answer: finalAnswer, sources }]);
    setDisplayedAnswer("");
    setStreamSources([]);
    setLoading(false);
  }, []);

  const startSoftStream = useCallback(() => {
    const tick = () => {
      const total = receivedRef.current.length;

      if (displayedLenRef.current < total) {
        displayedLenRef.current = Math.min(
          displayedLenRef.current + CHARS_PER_FRAME,
          total
        );
        setDisplayedAnswer(receivedRef.current.slice(0, displayedLenRef.current));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Caught up to buffer — check if backend is done
      if (isDoneRef.current) {
        rafRef.current = null;
        finalize();
        return;
      }

      // Still waiting for more tokens
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [finalize]);

  const stopSoftStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Autoscroll on every displayed token
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayedAnswer, streamSources]);

  // Smooth scroll when a turn completes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const handleSearch = async (query: string) => {
    receivedRef.current = "";
    displayedLenRef.current = 0;
    isDoneRef.current = false;
    finalSourcesRef.current = [];
    currentQueryRef.current = query;

    setLoading(true);
    setCurrentQuery(query);
    setDisplayedAnswer("");
    setStreamSources([]);
    setStatus("Thinking...");

    startSoftStream();

    const history = turns.map((t) => ({ query: t.query, answer: t.answer }));

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      });
      if (!res.ok || !res.body) throw new Error("Search request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.trim().split("\n");
          let event = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7);
            if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!event || !data) continue;
          const payload = JSON.parse(data);

          if (event === "status") setStatus(payload.message);
          if (event === "sources") {
            finalSourcesRef.current = payload.sources;
            setStreamSources(payload.sources);
          }
          if (event === "token") {
            receivedRef.current += payload.text;
          }
          if (event === "done") {
            // Don't stop RAF — let it drain the remaining buffer first
            isDoneRef.current = true;
          }
          if (event === "error") {
            stopSoftStream();
            setStatus(`Error: ${payload.message}`);
            setLoading(false);
          }
        }
      }
    } catch (err) {
      stopSoftStream();
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setLoading(false);
    }
  };

  return (
    <main className="h-screen bg-background flex flex-col overflow-hidden">

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 pt-16 pb-52 flex flex-col gap-10">

          {/* Empty state */}
          {turns.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Search</h1>
              <p className="text-xs text-white/30 tracking-wide">AI-powered answers with sources</p>
            </div>
          )}

          {/* Past turns */}
          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-6">
              <p className="text-white font-medium text-sm">{turn.query}</p>
              <SourcesList sources={turn.sources} />
              <AnswerStream answer={turn.answer} loading={false} status="" />
            </div>
          ))}

          {/* Current streaming turn */}
          {loading && (
            <div className="flex flex-col gap-6">
              <p className="text-white font-medium text-sm">{currentQuery}</p>
              <SourcesList sources={streamSources} />
              <AnswerStream answer={displayedAnswer} loading={loading} status={status} />
            </div>
          )}
        </div>
      </div>

      {/* Gradient fade behind floating input */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <div className="h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Floating input */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 px-4">
        <div className="w-full max-w-2xl pointer-events-auto">
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>
      </div>

    </main>
  );
}

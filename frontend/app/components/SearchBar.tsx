"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
  autoFocusOnMount?: boolean;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function SearchBar({ onSearch, loading, autoFocusOnMount = true }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = inputRef.current?.value.trim();
    if (query) {
      onSearch(query);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className="flex rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl
                 shadow-2xl shadow-black/50 overflow-hidden
                 focus-within:border-white/25
                 transition-all duration-300"
    >
      <form onSubmit={handleSubmit} className="flex w-full">
        <Input
          ref={inputRef}
          name="q"
          type="text"
          placeholder="Ask anything..."
          disabled={loading}
          autoFocus={autoFocusOnMount}
          className="flex-1 border-0 bg-transparent text-foreground placeholder:text-foreground-muted
                     focus-visible:ring-0 h-[52px] text-[15px] px-5 rounded-none font-normal"
        />
        <div className="flex items-center pr-2">
          <Button
            type="submit"
            disabled={loading}
            className="rounded-xl h-9 px-5 bg-white text-background text-sm font-semibold
                       hover:bg-white/85 disabled:opacity-40 transition-all duration-200
                       flex items-center justify-center min-w-[72px]"
          >
            {loading ? <Spinner /> : "Search"}
          </Button>
        </div>
      </form>
    </div>
  );
}

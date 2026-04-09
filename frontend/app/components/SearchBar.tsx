"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-black"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
    const query = input.value.trim();
    if (query) {
      onSearch(query);
      input.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-md shadow-lg shadow-black/40 overflow-hidden flex">
      <form onSubmit={handleSubmit} className="flex w-full">
        <Input
          name="q"
          type="text"
          placeholder="Ask anything..."
          disabled={loading}
          className="flex-1 border-0 bg-transparent text-white placeholder:text-white/30
                     focus-visible:ring-0 h-12 text-sm px-4 rounded-none"
          autoFocus
        />
        <Button
          type="submit"
          disabled={loading}
          className="rounded-none h-12 px-5 bg-white text-black hover:bg-white/90 disabled:opacity-30
                     flex items-center justify-center min-w-[64px] border-l border-white/10"
        >
          {loading ? <Spinner /> : <span className="text-sm font-medium">Search</span>}
        </Button>
      </form>
    </div>
  );
}

# AI Web Search Engine

A self-hosted, Perplexity-style AI search engine. Ask a question in natural language, get a cited, synthesized answer streamed token by token — backed by real web sources.

---

## How it works

```
User query
    │
    ▼
Query Rewriter   — LLM rewrites the query into 3 optimized search queries
    │               covering different angles (mechanisms, recency, evidence)
    ▼
Searcher         — Tavily API runs all 3 queries in parallel
    │               deduplicates results by URL, keeps highest-scored version
    ▼
Extractor        — pages with thin content (<300 chars) are fetched via
    │               Jina Reader (r.jina.ai) for full-page Markdown
    ▼
Reranker         — sorts by Tavily relevance score, takes top 8 sources,
    │               assigns citation indices [1]–[8]
    ▼
Synthesizer      — LLM streams a cited answer; every claim references [N]
    │
    ▼
SSE stream → FastAPI → Next.js → UI (token by token)
```

---

## Features

- **Streamed answers** — tokens appear as the LLM generates them, with a smooth character-by-character display effect
- **Inline citations** — every factual claim is cited with `[N]` badges linked to the source
- **Source cards** — ranked sources shown with favicons, titles, and URLs
- **Conversation memory** — follow-up questions retain context from previous turns
- **BYOK (Bring Your Own Key)** — configure any supported LLM provider and API key in the settings panel
- **Dynamic model selection** — model dropdowns are populated live from the provider's API using your key
- **Pipeline status** — shows the current processing stage (rewriting → searching → extracting → ranking → generating)
- **Self-hosted** — no data leaves your machine except the search queries and LLM calls you authorize

---

## Supported LLM Providers

| Provider | Notes |
|---|---|
| **Groq** | Default. Fast inference, free tier available |
| **OpenAI** | GPT-4o, GPT-4o Mini, o1 Mini |
| **Anthropic** | Claude Opus/Sonnet/Haiku |
| **OpenRouter** | 200+ models via a single API key |
| **Ollama** | Fully local, no key needed |

Switching provider and model is done through the settings modal — no code changes required.

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async API server with SSE streaming
- [LangGraph](https://langchain-ai.github.io/langgraph/) — stateful pipeline orchestration
- [LiteLLM](https://docs.litellm.ai/) — unified interface to all LLM providers
- [Tavily](https://tavily.com/) — LLM-optimized web search API
- [Jina Reader](https://jina.ai/reader/) — full-page content extraction fallback

**Frontend**
- [Next.js 16](https://nextjs.org/) (App Router, React 19)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) — Dialog, Select, Input, Button
- [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) — answer rendering with tables, code blocks, citations

---

## Project Structure

```
websearch-engine/
├── backend/
│   ├── main.py                        # FastAPI app — /api/search (SSE), /api/models
│   ├── pipeline/
│   │   ├── state.py                   # SearchState TypedDict
│   │   ├── graph.py                   # LangGraph pipeline graph
│   │   └── nodes/
│   │       ├── query_rewriter.py      # Rewrites query into 3 search queries
│   │       ├── searcher.py            # Parallel Tavily search + deduplication
│   │       ├── extractor.py           # Jina Reader fallback for thin content
│   │       ├── reranker.py            # Score-sort, top-8 selection, citation indexing
│   │       └── synthesizer.py        # Streaming LLM synthesis with citations
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── page.tsx                   # Main page — hero + conversation layout
    │   ├── api/
    │   │   ├── search/route.ts        # SSE proxy to FastAPI
    │   │   └── models/route.ts        # Model list proxy to FastAPI
    │   ├── components/
    │   │   ├── SearchBar.tsx          # Input with loading spinner
    │   │   ├── AnswerStream.tsx       # Markdown renderer with citation badges
    │   │   ├── SourcesList.tsx        # Source cards with favicons
    │   │   ├── PipelineStatus.tsx     # Animated single-stage status indicator
    │   │   ├── SettingsModal.tsx      # Provider/model/key configuration
    │   │   └── AnswerSkeleton.tsx     # Shimmer placeholder before first token
    │   └── hooks/
    │       └── useSettings.ts         # localStorage/sessionStorage config persistence
    └── package.json
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm (or npm)
- A [Tavily API key](https://tavily.com/) (free tier: 1,000 searches/month)
- An API key for at least one LLM provider (or Ollama running locally)

---

### 1. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `backend/.env`:

```env
TAVILY_API_KEY=tvly-your-key-here
GROQ_API_KEY=gsk_your-key-here        # used as the server-side default

# Default models used when the user has not configured their own key
FAST_MODEL=groq/llama-3.1-8b-instant
MAIN_MODEL=groq/llama-3.3-70b-versatile
```

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. You can verify it with:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

### 2. Frontend

```bash
cd frontend

# Install dependencies
pnpm install       # or: npm install

# Start development server
pnpm dev           # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

Click the **gear icon** (top-right) to open the settings panel.

| Field | Description |
|---|---|
| **Provider** | The LLM provider to use |
| **API Key** | Your key for that provider. Fetches the live model list on entry. |
| **Main model** | Used for answer synthesis (the quality-critical step) |
| **Fast model** | Used for query rewriting (latency-sensitive, cheaper) |
| **Remember API key** | Off by default — key lives in `sessionStorage` and is cleared when the browser closes. Toggle on to persist in `localStorage`. |

Settings are stored client-side only. Your API key is never logged or stored server-side.

If no key is configured, the backend falls back to the `GROQ_API_KEY` and model defaults in `.env`.

---

## API Reference

### `POST /api/search`

Streams an SSE response for a search query.

**Request body**
```json
{
  "query": "Why is the universe expanding?",
  "history": [
    { "query": "What is dark energy?", "answer": "Dark energy is..." }
  ],
  "llm_config": {
    "provider": "groq",
    "apiKey": "gsk_...",
    "fastModel": "groq/llama-3.1-8b-instant",
    "mainModel": "groq/llama-3.3-70b-versatile"
  }
}
```

**SSE events**

| Event | Payload | When |
|---|---|---|
| `status` | `{"message": "Searching the web..."}` | Each pipeline stage |
| `sources` | `{"sources": [{index, title, url, content, score}]}` | After reranking |
| `token` | `{"text": "..."}` | Each streamed LLM token |
| `done` | `{}` | Pipeline complete |
| `error` | `{"message": "..."}` | On exception |

---

### `POST /api/models`

Returns the available models for a given provider and API key.

**Request body**
```json
{ "provider": "groq", "apiKey": "gsk_..." }
```

**Response**
```json
{
  "models": [
    { "id": "groq/llama-3.3-70b-versatile", "label": "Llama 3 3 70B Versatile" }
  ]
}
```

Anthropic returns a static curated list (no public models API). Ollama queries `localhost:11434` directly.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TAVILY_API_KEY` | Yes | — | Tavily search API key |
| `GROQ_API_KEY` | No | — | Server-side fallback LLM key |
| `FAST_MODEL` | No | `groq/llama-3.1-8b-instant` | Default fast model |
| `MAIN_MODEL` | No | `groq/llama-3.3-70b-versatile` | Default main model |

---

## Development Notes

**Adding a new LLM provider**

1. Add an entry to `PROVIDERS` in `frontend/app/hooks/useSettings.ts` with `label`, `fastModel`, `mainModel`, `keyPlaceholder`, `keyDocsUrl`
2. Add the provider's models endpoint to `PROVIDER_MODEL_ENDPOINTS` in `backend/main.py`
3. LiteLLM handles routing automatically — no changes to the pipeline nodes

**Adjusting streaming speed**

In `frontend/app/page.tsx`, `CHARS_PER_FRAME` controls how many characters are revealed per animation frame (~60fps):

```ts
const CHARS_PER_FRAME = 3; // 3 = smooth, 1 = very slow, 8 = fast
```

**Changing the number of sources**

In `backend/pipeline/nodes/reranker.py`, adjust `MAX_SOURCES` (default: 8).

**Changing the number of search queries**

In `backend/pipeline/nodes/query_rewriter.py`, the system prompt instructs the LLM to produce exactly 3 queries. Adjust both the prompt and the slice in `query_rewriter()`.

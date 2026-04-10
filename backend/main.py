import json
import os
import warnings
from dotenv import load_dotenv

load_dotenv()

# Suppress LiteLLM's internal Pydantic model mismatch warnings (cosmetic upstream bug)
warnings.filterwarnings("ignore", message="Pydantic serializer warnings", category=UserWarning)

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline.nodes.query_rewriter import query_rewriter
from pipeline.nodes.searcher import searcher
from pipeline.nodes.extractor import extractor
from pipeline.nodes.reranker import reranker
from pipeline.nodes.synthesizer import synthesizer
from pipeline.nodes.gap_analyzer import gap_analyzer
from pipeline.state import SearchState

app = FastAPI(title="AI Search Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class HistoryTurn(BaseModel):
    query: str
    answer: str


class LLMConfig(BaseModel):
    provider:   str = ""
    apiKey:     str = ""
    fastModel:  str = ""
    mainModel:  str = ""


class SearchRequest(BaseModel):
    query:      str
    history:    list[HistoryTurn] = []
    llm_config: LLMConfig = LLMConfig()
    mode:       str = "search"


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _resolve_models(llm_config: LLMConfig) -> tuple[str, str, str | None]:
    """Returns (fast_model, main_model, api_key | None)."""
    api_key   = llm_config.apiKey  or None
    fast_model = llm_config.fastModel or os.getenv("FAST_MODEL", "groq/llama-3.1-8b-instant")
    main_model = llm_config.mainModel or os.getenv("MAIN_MODEL", "groq/llama-3.3-70b-versatile")
    return fast_model, main_model, api_key


async def _search_generator(query: str, history: list[HistoryTurn], llm_config: LLMConfig, mode: str = "search"):
    print(f"[search] mode={mode!r} query={query[:60]!r}")
    try:
        fast_model, main_model, api_key = _resolve_models(llm_config)

        state: SearchState = {
            "query": query,
            "rewritten_queries": [],
            "raw_results": [],
            "sources": [],
            "answer": "",
            "status": "Rewriting query...",
            "mode": mode,
        }

        yield _sse("status", {"message": "Rewriting query..."})
        state.update(await query_rewriter(state, model=fast_model, api_key=api_key, mode=mode))

        yield _sse("status", {"message": "Searching the web..."})
        state.update(await searcher(state, mode=mode))

        yield _sse("status", {"message": "Extracting content..."})
        state.update(await extractor(state, mode=mode))

        yield _sse("status", {"message": "Ranking results..."})
        update = reranker(state, mode=mode)
        state["sources"] = update.get("sources", [])
        state["status"]  = update.get("status", state["status"])

        if mode == "research":
            # Round 2: gap analysis + follow-up search
            yield _sse("status", {"message": "Analyzing gaps..."})
            follow_up_queries = await gap_analyzer(state, model=fast_model, api_key=api_key)

            if follow_up_queries:
                yield _sse("status", {"message": "Deep searching..."})

                # Run follow-up search with a temporary state slice
                gap_state: SearchState = {**state, "rewritten_queries": follow_up_queries, "raw_results": []}
                gap_state.update(await searcher(gap_state, mode=mode))
                gap_state.update(await extractor(gap_state, mode=mode))

                # Merge follow-up raw results with original, then re-rank deduped
                existing_urls = {s["url"] for s in state["sources"]}
                merged_raw = state.get("raw_results", []) + gap_state["raw_results"]
                merged_state: SearchState = {**state, "raw_results": merged_raw}

                yield _sse("status", {"message": "Ranking results..."})
                round2_update = reranker(merged_state, mode=mode, existing_urls=existing_urls)
                # Append new unique sources (already deduped inside reranker)
                new_sources = round2_update.get("sources", [])
                # Re-index combined sources
                all_sources = state["sources"] + new_sources
                for i, src in enumerate(all_sources, start=1):
                    src["index"] = i
                state["sources"] = all_sources

        yield _sse("sources", {"sources": state["sources"]})

        yield _sse("status", {"message": "Generating answer..."})
        async for token in synthesizer(
            state,
            history=[h.model_dump() for h in history],
            model=main_model,
            api_key=api_key,
            mode=mode,
        ):
            yield _sse("token", {"text": token})

        yield _sse("done", {})

    except Exception as e:
        print(f"[pipeline error] {type(e).__name__}: {e}")
        yield _sse("error", {"message": str(e)})


@app.post("/api/search")
async def search(req: SearchRequest):
    return StreamingResponse(
        _search_generator(req.query, req.history, req.llm_config, req.mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class ModelListRequest(BaseModel):
    provider: str
    apiKey:   str = ""


# Anthropic has no public models API — return a curated static list
ANTHROPIC_MODELS = [
    {"id": "claude-opus-4-6",           "label": "Claude Opus 4.6"},
    {"id": "claude-sonnet-4-6",         "label": "Claude Sonnet 4.6"},
    {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
]

PROVIDER_MODEL_ENDPOINTS = {
    "groq":       "https://api.groq.com/openai/v1/models",
    "openai":     "https://api.openai.com/v1/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
}

# Models to filter out — embeddings, audio, vision-only, deprecated
FILTER_KEYWORDS = ["embed", "whisper", "tts", "dall-e", "babbage", "davinci",
                   "ada", "curie", "vision", "instruct-beta", "preview"]

def _clean_label(model_id: str) -> str:
    """Turn a model ID into a readable label."""
    name = model_id.split("/")[-1]
    return name.replace("-", " ").replace("_", " ").title()


@app.post("/api/models")
async def list_models(req: ModelListRequest):
    if req.provider == "anthropic":
        return {"models": ANTHROPIC_MODELS}

    if req.provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get("http://localhost:11434/api/tags")
                r.raise_for_status()
                tags = r.json().get("models", [])
                models = [{"id": f"ollama/{m['name']}", "label": m["name"]} for m in tags]
                return {"models": models}
        except Exception:
            return {"models": [], "error": "Ollama not running on localhost:11434"}

    endpoint = PROVIDER_MODEL_ENDPOINTS.get(req.provider)
    if not endpoint or not req.apiKey:
        return {"models": [], "error": "Missing API key or unsupported provider"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {req.apiKey}"},
            )
            r.raise_for_status()
            data = r.json()

        raw_models = data.get("data", [])

        # OpenRouter has different shape
        if req.provider == "openrouter":
            models = []
            for m in raw_models:
                mid = m.get("id", "")
                label = m.get("name") or _clean_label(mid)
                if any(k in mid.lower() for k in FILTER_KEYWORDS):
                    continue
                models.append({"id": f"openrouter/{mid}", "label": label})
        else:
            prefix = "groq/" if req.provider == "groq" else ""
            models = []
            for m in raw_models:
                mid = m.get("id", "")
                if any(k in mid.lower() for k in FILTER_KEYWORDS):
                    continue
                models.append({"id": f"{prefix}{mid}", "label": _clean_label(mid)})

        # Sort alphabetically
        models.sort(key=lambda m: m["label"].lower())
        return {"models": models}

    except httpx.HTTPStatusError as e:
        return {"models": [], "error": f"Provider returned {e.response.status_code}"}
    except Exception as e:
        return {"models": [], "error": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok"}

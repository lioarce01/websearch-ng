import json
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline.nodes.query_rewriter import query_rewriter
from pipeline.nodes.searcher import searcher
from pipeline.nodes.extractor import extractor
from pipeline.nodes.reranker import reranker
from pipeline.nodes.synthesizer import synthesizer
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


class SearchRequest(BaseModel):
    query: str
    history: list[HistoryTurn] = []


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _search_generator(query: str, history: list[HistoryTurn]):
    try:
        state: SearchState = {
            "query": query,
            "rewritten_queries": [],
            "raw_results": [],
            "sources": [],
            "answer": "",
            "status": "Rewriting query...",
        }

        yield _sse("status", {"message": "Rewriting query..."})
        state.update(await query_rewriter(state))

        yield _sse("status", {"message": "Searching the web..."})
        state.update(await searcher(state))

        yield _sse("status", {"message": "Extracting content..."})
        state.update(await extractor(state))

        yield _sse("status", {"message": "Ranking results..."})
        update = reranker(state)
        state["sources"] = state.get("sources", []) + update.get("sources", [])
        state["status"] = update.get("status", state["status"])

        yield _sse("sources", {"sources": state["sources"]})

        yield _sse("status", {"message": "Generating answer..."})
        async for token in synthesizer(state, history=[h.model_dump() for h in history]):
            yield _sse("token", {"text": token})

        yield _sse("done", {})

    except Exception as e:
        yield _sse("error", {"message": str(e)})


@app.post("/api/search")
async def search(req: SearchRequest):
    return StreamingResponse(
        _search_generator(req.query, req.history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}

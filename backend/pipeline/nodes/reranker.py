from pipeline.state import SearchState, Source

MAX_SOURCES = 8


def reranker(state: SearchState) -> dict:
    raw = state["raw_results"]

    # Sort by Tavily relevance score descending
    ranked = sorted(raw, key=lambda r: r.get("score", 0), reverse=True)

    sources: list[Source] = []
    for i, r in enumerate(ranked[:MAX_SOURCES], start=1):
        content = r.get("raw_content") or r.get("content", "")
        sources.append(
            Source(
                index=i,
                title=r.get("title", r.get("url", "")),
                url=r.get("url", ""),
                content=content[:2000],  # cap per source
                score=r.get("score", 0.0),
            )
        )

    return {
        "sources": sources,
        "status": "Generating answer...",
    }

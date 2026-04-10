from pipeline.state import SearchState, Source


def reranker(state: SearchState, mode: str = "search", existing_urls: set | None = None) -> dict:
    raw = state["raw_results"]

    # Research: 8 sources × 1500 chars ≈ 4k source tokens + ~1.5k prompt overhead → ~6k total, fits Groq 12k TPM
    max_sources = 8 if mode == "research" else 8
    content_cap = 1500 if mode == "research" else 2000

    # Sort by Tavily relevance score descending
    ranked = sorted(raw, key=lambda r: r.get("score", 0), reverse=True)

    # Deduplicate against already-ranked sources (used in research round 2)
    seen_urls = existing_urls or set()

    sources: list[Source] = []
    rank = 1
    for r in ranked:
        if len(sources) >= max_sources:
            break
        url = r.get("url", "")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        content = r.get("raw_content") or r.get("content", "")
        sources.append(
            Source(
                index=rank,
                title=r.get("title", url),
                url=url,
                content=content[:content_cap],
                score=r.get("score", 0.0),
            )
        )
        rank += 1

    return {
        "sources": sources,
        "status": "Generating answer...",
    }

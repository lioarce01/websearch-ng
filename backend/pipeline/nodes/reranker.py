from pipeline.state import SearchState, Source


def reranker(
    state: SearchState,
    mode: str = "search",
    existing_urls: set | None = None,
    max_sources: int = 8,
    content_cap: int = 2000,
) -> dict:
    raw = state["raw_results"]

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

import asyncio
import os
from tavily import AsyncTavilyClient
from pipeline.state import SearchState


async def searcher(state: SearchState) -> dict:
    client = AsyncTavilyClient(api_key=os.environ["TAVILY_API_KEY"])

    async def search_one(query: str) -> list[dict]:
        try:
            response = await client.search(
                query=query,
                max_results=5,
                include_raw_content=True,  # fetch full page content when available
            )
            return response.get("results", [])
        except Exception:
            return []

    results_nested = await asyncio.gather(
        *[search_one(q) for q in state["rewritten_queries"]]
    )

    # Flatten and deduplicate by URL (keep highest-scored version)
    seen: dict[str, dict] = {}
    for results in results_nested:
        for r in results:
            url = r.get("url", "")
            if url not in seen or r.get("score", 0) > seen[url].get("score", 0):
                seen[url] = r

    return {
        "raw_results": list(seen.values()),
        "status": "Extracting content...",
    }

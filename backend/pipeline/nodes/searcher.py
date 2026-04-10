import asyncio
import os
from tavily import AsyncTavilyClient
from pipeline.state import SearchState


DAYS_MAP = {"day": 1, "week": 7, "month": 30, "year": 365}


async def searcher(state: SearchState, mode: str = "search", time_range: str = "", include_domains: list[str] = []) -> dict:
    client = AsyncTavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    max_results = 7 if mode == "research" else 5
    days = DAYS_MAP.get(time_range)  # None if time_range is "" or unrecognized

    async def search_one(query: str) -> list[dict]:
        try:
            kwargs = dict(
                query=query,
                max_results=max_results,
                include_raw_content=True,
            )
            if days is not None:
                kwargs["days"] = days
            if include_domains:
                kwargs["include_domains"] = include_domains
            response = await client.search(**kwargs)
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

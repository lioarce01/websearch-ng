import asyncio
import httpx
from pipeline.state import SearchState

CONTENT_MIN_LENGTH = 300
JINA_TIMEOUT = 10  # seconds per page
JINA_BASE = "https://r.jina.ai/"


async def _fetch_jina(client: httpx.AsyncClient, url: str, char_cap: int = 3000) -> str | None:
    try:
        resp = await client.get(
            f"{JINA_BASE}{url}",
            timeout=JINA_TIMEOUT,
            headers={"Accept": "text/plain"},
            follow_redirects=True,
        )
        if resp.status_code == 200 and resp.text:
            return resp.text[:char_cap]
    except Exception:
        pass
    return None


async def extractor(state: SearchState, mode: str = "search") -> dict:
    raw_results = state["raw_results"]
    char_cap = 5000 if mode == "research" else 3000

    # Research mode: fetch all pages for maximum content depth
    # Normal mode: only fetch pages with thin content
    if mode == "research":
        needs_fetch = raw_results
    else:
        needs_fetch = [
            r for r in raw_results
            if len(r.get("raw_content") or r.get("content", "")) < CONTENT_MIN_LENGTH
        ]

    if not needs_fetch:
        return {"raw_results": raw_results, "status": "Ranking results..."}

    async with httpx.AsyncClient() as client:
        fetched = await asyncio.gather(
            *[_fetch_jina(client, r["url"], char_cap) for r in needs_fetch]
        )

    fetch_map = {r["url"]: content for r, content in zip(needs_fetch, fetched)}
    updated = []
    for r in raw_results:
        if r["url"] in fetch_map and fetch_map[r["url"]]:
            r = {**r, "raw_content": fetch_map[r["url"]]}
        updated.append(r)

    return {"raw_results": updated, "status": "Ranking results..."}

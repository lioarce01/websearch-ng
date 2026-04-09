import asyncio
import httpx
from pipeline.state import SearchState

CONTENT_MIN_LENGTH = 300
JINA_TIMEOUT = 10  # seconds per page
JINA_BASE = "https://r.jina.ai/"


async def _fetch_jina(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        resp = await client.get(
            f"{JINA_BASE}{url}",
            timeout=JINA_TIMEOUT,
            headers={"Accept": "text/plain"},
            follow_redirects=True,
        )
        if resp.status_code == 200 and resp.text:
            return resp.text[:3000]
    except Exception:
        pass
    return None


async def extractor(state: SearchState) -> dict:
    raw_results = state["raw_results"]

    needs_fetch = [
        r for r in raw_results
        if len(r.get("raw_content") or r.get("content", "")) < CONTENT_MIN_LENGTH
    ]

    if not needs_fetch:
        return {"raw_results": raw_results, "status": "Ranking results..."}

    async with httpx.AsyncClient() as client:
        fetched = await asyncio.gather(
            *[_fetch_jina(client, r["url"]) for r in needs_fetch]
        )

    fetch_map = {r["url"]: content for r, content in zip(needs_fetch, fetched)}
    updated = []
    for r in raw_results:
        if r["url"] in fetch_map and fetch_map[r["url"]]:
            r = {**r, "raw_content": fetch_map[r["url"]]}
        updated.append(r)

    return {"raw_results": updated, "status": "Ranking results..."}

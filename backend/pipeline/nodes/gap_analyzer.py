import json
import re
import litellm
from pipeline.state import SearchState

GAP_ANALYZER_PROMPT = """You are a research editor. You will be given a research question and a set of sources collected so far.

Your task: identify 3 specific follow-up search queries that target information missing from the sources — angles not covered, claims that need verification, contradictions that need resolution, or expert perspectives not yet represented.

Rules:
- Queries must be highly specific, not broad topic rehashes
- Each query targets a different gap
- Use precise keywords experts would use

YOU MUST RESPOND WITH ONLY THIS JSON — no explanation, no preamble, nothing else:
{"queries": ["query1", "query2", "query3"]}"""


def _build_sources_summary(state: SearchState) -> str:
    lines = []
    for source in state["sources"]:
        lines.append(
            f"[{source['index']}] {source['title']}\n"
            f"URL: {source['url']}\n"
            f"Content snippet: {source['content'][:800]}\n"
        )
    return "\n---\n".join(lines)


def _extract_queries_from_text(text: str) -> list[str]:
    """Fallback: try to extract a JSON object or array from raw text."""
    # Try to find a JSON object in the text
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            queries = parsed.get("queries", [])
            if isinstance(queries, list):
                return [q for q in queries if isinstance(q, str)][:3]
        except json.JSONDecodeError:
            pass

    # Try to find a JSON array directly
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            queries = json.loads(match.group())
            if isinstance(queries, list):
                return [q for q in queries if isinstance(q, str)][:3]
        except json.JSONDecodeError:
            pass

    return []


async def gap_analyzer(
    state: SearchState,
    model: str = "groq/llama-3.1-8b-instant",
    api_key: str | None = None,
) -> list[str]:
    """
    Analyzes current sources for knowledge gaps and returns follow-up search queries.
    Returns a list of query strings (empty list on failure).
    """
    sources_summary = _build_sources_summary(state)

    user_message = (
        f"Research question: {state['query']}\n\n"
        f"Sources collected so far:\n\n{sources_summary}\n\n"
        f'Return JSON only: {{"queries": ["...", "...", "..."]}}'
    )

    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": GAP_ANALYZER_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )
    # Only add response_format if the model likely supports it
    # (avoids breaking Anthropic/Ollama providers)
    if not any(p in model for p in ("claude", "ollama", "anthropic")):
        kwargs["response_format"] = {"type": "json_object"}

    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = await litellm.acompletion(**kwargs)
        raw = response.choices[0].message.content or ""

        # First try: direct JSON parse
        try:
            parsed = json.loads(raw)
            queries = parsed.get("queries", [])
            if isinstance(queries, list) and queries:
                return [q for q in queries if isinstance(q, str)][:3]
        except (json.JSONDecodeError, AttributeError):
            pass

        # Fallback: extract JSON from prose response
        queries = _extract_queries_from_text(raw)
        if queries:
            return queries

        print(f"[gap_analyzer] Could not parse queries from response: {raw[:200]!r}")

    except Exception as e:
        print(f"[gap_analyzer] Error: {e}")

    return []

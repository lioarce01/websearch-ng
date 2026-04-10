import json
import re
import litellm


SYSTEM_PROMPT = """You are a concise research assistant. Given a research report and the original question, return a JSON object with two fields:

1. "theme": A hyper-concise 3-6 word topic label that captures the core subject (e.g. "Self-hosted AI web search", "Claude Mythos benchmarks", "React Server Components"). No punctuation at the end.

2. "teaser": A 3-4 sentence plain-prose summary. Always start with "Research complete. It covers " followed by a comma-separated list of the main topics. Then 1-2 sentences on the key findings or conclusions. No markdown, no bullet points.

Return ONLY valid JSON: {"theme": "...", "teaser": "..."}"""


def _parse(raw: str) -> tuple[str, str]:
    """Extract theme and teaser from the model response."""
    try:
        parsed = json.loads(raw)
        return parsed.get("theme", "").strip(), parsed.get("teaser", "").strip()
    except (json.JSONDecodeError, AttributeError):
        pass
    # Regex fallback
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            return parsed.get("theme", "").strip(), parsed.get("teaser", "").strip()
        except json.JSONDecodeError:
            pass
    return "", ""


async def summarizer(
    query: str,
    answer: str,
    model: str = "groq/llama-3.1-8b-instant",
    api_key: str | None = None,
) -> tuple[str, str]:
    """
    Generates a short theme label and a 3-4 sentence teaser for a research report.
    Returns (theme, teaser) — empty strings on failure.
    """
    excerpt = answer[:4000]
    user_message = f"Question: {query}\n\nReport:\n{excerpt}"

    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=200,
    )
    if not any(p in model for p in ("claude", "ollama", "anthropic")):
        kwargs["response_format"] = {"type": "json_object"}
    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = await litellm.acompletion(**kwargs)
        raw = (response.choices[0].message.content or "").strip()
        return _parse(raw)
    except Exception as e:
        print(f"[summarizer] Error: {e}")
        return "", ""

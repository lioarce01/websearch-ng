import json
import re
from datetime import date
import litellm
from pipeline.state import SearchState


def _build_prompt() -> str:
    today = date.today().strftime("%B %d, %Y")
    return f"""You are a research assistant. Today's date is {today}. Given a question and some context about the answer, generate exactly 3 follow-up questions the user would naturally want to ask next.

Rules:
- Each question targets a genuinely different angle (don't rephrase the same thing)
- Keep them concise — under 12 words each
- Make them feel like natural conversation continuations, not academic queries
- Be aware of the current date ({today}) — do NOT reference outdated versions, models, or events when more recent ones exist. If referencing AI models, products, or technologies, use the most current known versions.

Return ONLY valid JSON: {{"questions": ["q1", "q2", "q3"]}}\""""


def _extract_questions(text: str) -> list[str]:
    """Two-stage extraction: direct JSON parse → regex fallback."""
    try:
        parsed = json.loads(text)
        questions = parsed.get("questions", [])
        if isinstance(questions, list) and questions:
            return [q for q in questions if isinstance(q, str)][:3]
    except (json.JSONDecodeError, AttributeError):
        pass

    # Regex fallback: find JSON object or array in prose
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            questions = parsed.get("questions", [])
            if isinstance(questions, list):
                return [q for q in questions if isinstance(q, str)][:3]
        except json.JSONDecodeError:
            pass

    return []


async def suggester(
    state: SearchState,
    model: str = "groq/llama-3.1-8b-instant",
    api_key: str | None = None,
    answer: str = "",
) -> list[str]:
    """
    Generates 3 follow-up question suggestions based on the query and generated answer.
    Returns a list of question strings (empty list on any failure).
    """
    # Use the actual answer as primary context — far more accurate than source titles
    answer_excerpt = answer[:2000] if answer else ""
    user_message = (
        f"Question: {state['query']}\n\n"
        f"Answer:\n{answer_excerpt}\n\n"
        f'Return JSON only: {{"questions": ["...", "...", "..."]}}'
    )

    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": _build_prompt()},
            {"role": "user", "content": user_message},
        ],
        temperature=0.6,
        max_tokens=200,
    )
    if not any(p in model for p in ("claude", "ollama", "anthropic")):
        kwargs["response_format"] = {"type": "json_object"}
    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = await litellm.acompletion(**kwargs)
        raw = response.choices[0].message.content or ""
        questions = _extract_questions(raw)
        if questions:
            return questions
        print(f"[suggester] Could not parse questions from: {raw[:150]!r}")
    except Exception as e:
        print(f"[suggester] Error: {e}")

    return []

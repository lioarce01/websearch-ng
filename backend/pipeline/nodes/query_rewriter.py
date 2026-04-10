import json
import re
import litellm
from pipeline.state import SearchState


REWRITE_PROMPT = """You are an elite research strategist working for a world-class intelligence agency. Your job is to decompose a user's question into the most effective possible set of web search queries that will retrieve comprehensive, high-quality information.

Given a user question, generate exactly 3 search queries following these principles:

QUERY DESIGN RULES:
1. **Coverage**: Each query must target a genuinely different angle — mechanisms, evidence, context, recent developments, expert opinion, counterarguments, or concrete examples. Never repeat the same angle with different words.
2. **Precision**: Use specific technical terms, proper nouns, dates, and domain-specific vocabulary that experts and authoritative sources would use. Avoid vague language.
3. **Recency**: At least one query should target recent developments (append current year or "2025 2026" when the topic is time-sensitive).
4. **Source diversity**: Design queries to pull from different source types — academic/research papers, news, technical documentation, expert analysis, data/statistics.
5. **Search-engine optimized**: Queries should look like what an expert researcher would type — no question marks, no conversational phrasing, just precise keyword strings.

OUTPUT: Return ONLY a JSON object with a single key "queries" containing an array of exactly 3 strings. No explanation, no preamble.

EXAMPLES:

User: "Why is the US housing market so unaffordable?"
Output: {"queries": ["US housing affordability crisis causes supply constraints zoning 2024 2025", "housing price to income ratio historical data United States Federal Reserve interest rates", "single family zoning reform YIMBY movement housing supply research economists"]}

User: "How does mRNA vaccine technology work?"
Output: {"queries": ["mRNA vaccine mechanism lipid nanoparticle delivery protein synthesis immune response", "mRNA vaccine development history Moderna BioNTech Katalin Karikó Drew Weissman research", "mRNA vaccine safety efficacy clinical trial data long term immunology"]}

User: "What's happening with AI regulation in Europe?"
Output: {"queries": ["EU AI Act 2025 implementation requirements high risk systems compliance", "European artificial intelligence regulation enforcement penalties prohibited use cases", "EU AI Act impact tech companies GPT models foundation model obligations 2025"]}"""

RESEARCH_REWRITE_PROMPT = """You are a world-class investigative research director at a top-tier think tank. Your job is to design the most comprehensive, strategically diverse search campaign possible for a given topic.

Generate exactly 7 search queries that collectively ensure no important angle is missed. Each query must target a genuinely different epistemic dimension:

1. FOUNDATIONAL — Core definitions, mechanisms, first principles. What this is and how it works at a technical level.
2. EMPIRICAL — Hard data, statistics, peer-reviewed studies, measurements. Quantitative evidence only.
3. HISTORICAL — Origins, timeline, how it developed, key turning points. Where it came from.
4. EXPERT CONSENSUS — What leading institutions, journals, and authorities say. Established mainstream position.
5. DISSENT/CRITIQUE — Counterarguments, limitations, criticisms, what rigorous skeptics say. The strongest opposing view.
6. RECENT/EMERGING — Developments in 2024-2025, latest research, new findings, recent policy or market changes.
7. PRACTICAL/APPLIED — Real-world implementations, case studies, consequences, on-the-ground effects.

Rules:
- Use precise technical vocabulary that authoritative sources use — no conversational phrasing, no question marks
- Each query must reach a different source type: academic papers, investigative journalism, government/institutional reports, industry analysis, technical documentation
- Queries must be complementary, never overlapping — if two queries could return the same results, rewrite one
- Append "2025" or "2024 2025" to time-sensitive queries

Return ONLY valid JSON: {"queries": ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]}"""


async def query_rewriter(
    state: SearchState,
    model: str = "groq/llama-3.1-8b-instant",
    api_key: str | None = None,
    mode: str = "search",
) -> dict:
    is_research = mode == "research"
    prompt = RESEARCH_REWRITE_PROMPT if is_research else REWRITE_PROMPT
    max_queries = 7 if is_research else 3

    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": state["query"]},
        ],
        temperature=0.4,
    )
    # Only add response_format for models that support it reliably
    if not any(p in model for p in ("claude", "ollama", "anthropic")):
        kwargs["response_format"] = {"type": "json_object"}

    if api_key:
        kwargs["api_key"] = api_key

    response = await litellm.acompletion(**kwargs)
    raw = response.choices[0].message.content or ""

    queries = None

    # First try: direct JSON parse
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            queries = parsed
        else:
            val = next(iter(parsed.values()), None)
            if isinstance(val, list):
                queries = val
    except (json.JSONDecodeError, StopIteration):
        pass

    # Fallback: extract a JSON array from prose
    if not queries:
        match = re.search(r'\[.*?\]', raw, re.DOTALL)
        if match:
            try:
                queries = json.loads(match.group())
            except json.JSONDecodeError:
                pass

    if not isinstance(queries, list) or not queries:
        queries = [state["query"]]

    # Ensure original query is always covered
    if state["query"] not in queries:
        queries.insert(0, state["query"])

    return {
        "rewritten_queries": queries[:max_queries],
        "status": "Searching the web...",
    }

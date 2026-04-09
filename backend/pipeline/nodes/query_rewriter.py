import json
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


async def query_rewriter(
    state: SearchState,
    model: str = "groq/llama-3.1-8b-instant",
    api_key: str | None = None,
) -> dict:
    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": REWRITE_PROMPT},
            {"role": "user", "content": state["query"]},
        ],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    if api_key:
        kwargs["api_key"] = api_key

    response = await litellm.acompletion(**kwargs)

    raw = response.choices[0].message.content
    parsed = json.loads(raw)

    if isinstance(parsed, list):
        queries = parsed
    else:
        queries = next(iter(parsed.values()))

    if not isinstance(queries, list):
        queries = [state["query"]]

    # Ensure original query is always covered
    if state["query"] not in queries:
        queries.insert(0, state["query"])

    return {
        "rewritten_queries": queries[:3],
        "status": "Searching the web...",
    }

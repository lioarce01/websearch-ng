from typing import TypedDict, Annotated
import operator


class Source(TypedDict):
    index: int
    title: str
    url: str
    content: str
    score: float


class SearchState(TypedDict):
    query: str                                       # original user query
    rewritten_queries: list[str]                     # LLM-generated search queries
    raw_results: list[dict]                          # raw Tavily results
    sources: Annotated[list[Source], operator.add]  # ranked, indexed sources
    answer: str                                      # final synthesized answer
    status: str                                      # current pipeline stage label

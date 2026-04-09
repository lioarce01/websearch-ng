from langgraph.graph import StateGraph, START, END
from pipeline.state import SearchState
from pipeline.nodes.query_rewriter import query_rewriter
from pipeline.nodes.searcher import searcher
from pipeline.nodes.extractor import extractor
from pipeline.nodes.reranker import reranker


def build_graph() -> StateGraph:
    """
    Builds the LangGraph pipeline for stages 1-4 (before streaming synthesis).
    Can be used standalone via graph.ainvoke() or nodes can be called directly
    for fine-grained SSE control (see main.py).
    """
    builder = StateGraph(SearchState)

    builder.add_node("query_rewriter", query_rewriter)
    builder.add_node("searcher", searcher)
    builder.add_node("extractor", extractor)
    builder.add_node("reranker", reranker)

    builder.add_edge(START, "query_rewriter")
    builder.add_edge("query_rewriter", "searcher")
    builder.add_edge("searcher", "extractor")
    builder.add_edge("extractor", "reranker")
    builder.add_edge("reranker", END)

    return builder.compile()


graph = build_graph()

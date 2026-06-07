"""RAG query pipeline — retrieve from Pinecone, generate answer with OpenAI."""

from __future__ import annotations

from typing import Any

from openai import OpenAI

from config import settings
from embeddings import embed_query
from pinecone_store import get_index_stats, metadata_to_car, query_vectors

SYSTEM_PROMPT = """You are Cars24 Assistant, a helpful used-car shopping advisor.
You answer questions about used cars listed on Cars24 using ONLY the vehicle context provided.

Rules:
- Be concise, friendly, and conversational. Use ₹ for prices.
- Remember prior messages in the conversation — users may ask follow-ups like "which is cheapest?", "tell me more about the second one", or "any in Mumbai?".
- When recommending cars, mention title, price, mileage, fuel, transmission, location.
- Car cards with photos are shown separately in the UI — keep your text brief; don't repeat full listing details the user can already see.
- If the context doesn't contain matching cars, say so honestly and suggest refining the query.
- Never invent vehicles, prices, or specs not present in the context.
- You may compare multiple cars when asked.
"""


def build_context(matches: list[dict[str, Any]]) -> str:
    if not matches:
        return "No matching vehicles found in the database."

    sections = []
    for i, match in enumerate(matches, 1):
        meta = match.get("metadata", {})
        text = meta.get("text") or ""
        score = match.get("score", 0)
        sections.append(f"[Car {i}] (relevance: {score:.2f})\n{text}")

    return "\n\n".join(sections)


def extract_cars_from_matches(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    cars: list[dict[str, Any]] = []

    for match in matches:
        meta = match.get("metadata", {})
        vid = meta.get("vehicle_id", "")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        car = metadata_to_car(meta)
        car["relevanceScore"] = round(match.get("score", 0), 3)
        cars.append(car)

    return cars


def _build_llm_messages(
    message: str,
    context: str,
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        for turn in history[-20:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": f"Context from Cars24 listings:\n\n{context}\n\nUser question: {message}",
        }
    )
    return messages


def retrieve_for_chat(message: str, top_k: int = 6) -> tuple[str, list[dict[str, Any]]]:
    """Embed query, search Pinecone, return context string and car list."""
    query_embedding = embed_query(message)
    matches = query_vectors(query_embedding, top_k=top_k)
    return build_context(matches), extract_cars_from_matches(matches)


def chat(
    message: str,
    history: list[dict[str, str]] | None = None,
    top_k: int = 6,
) -> dict[str, Any]:
    """Run a RAG chat turn."""
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    context, cars = retrieve_for_chat(message, top_k=top_k)
    client = OpenAI(api_key=settings.openai_api_key)
    messages = _build_llm_messages(message, context, history)

    response = client.chat.completions.create(
        model=settings.chat_model,
        messages=messages,
        temperature=0.4,
        max_tokens=800,
    )

    answer = response.choices[0].message.content or ""

    return {
        "answer": answer,
        "cars": cars,
        "sources_count": len(cars),
    }


def _build_search_query(message: str, history: list[dict[str, str]] | None = None) -> str:
    """Combine recent conversation context for better follow-up retrieval."""
    parts: list[str] = []
    if history:
        for turn in history[-6:]:
            content = turn.get("content", "").strip()
            if content:
                parts.append(content)
    parts.append(message)
    return " ".join(parts[-4:])


def chat_stream(
    message: str,
    history: list[dict[str, str]] | None = None,
    top_k: int = 6,
):
    """Yield SSE events: car (one per vehicle), then done. No text tokens."""
    import json

    search_query = _build_search_query(message, history)
    query_embedding = embed_query(search_query)
    matches = query_vectors(query_embedding, top_k=top_k)
    cars = extract_cars_from_matches(matches)

    for car in cars:
        yield f"event: car\ndata: {json.dumps(car)}\n\n"

    yield "event: done\ndata: {}\n\n"


def health_info() -> dict[str, Any]:
    info: dict[str, Any] = {
        "openai_configured": bool(settings.openai_api_key),
        "pinecone_configured": bool(settings.pinecone_api_key),
        "index_name": settings.pinecone_index_name,
    }

    if settings.pinecone_api_key:
        try:
            info["index_stats"] = get_index_stats()
        except Exception as exc:
            info["index_error"] = str(exc)

    return info

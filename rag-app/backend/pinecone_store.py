"""Pinecone index management and vector operations."""

from __future__ import annotations

import json
from typing import Any

from pinecone import Pinecone, ServerlessSpec

from config import settings
from embeddings import embed_texts

_pc: Pinecone | None = None
_index = None


def get_pinecone() -> Pinecone:
    global _pc
    if _pc is None:
        if not settings.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is not set")
        _pc = Pinecone(api_key=settings.pinecone_api_key)
    return _pc


def get_index():
    global _index
    if _index is None:
        pc = get_pinecone()
        _index = pc.Index(settings.pinecone_index_name)
    return _index


def ensure_index_exists() -> None:
    """Create the Pinecone index if it doesn't exist."""
    pc = get_pinecone()
    existing = {idx.name for idx in pc.list_indexes()}

    if settings.pinecone_index_name in existing:
        return

    pc.create_index(
        name=settings.pinecone_index_name,
        dimension=settings.embedding_dimensions,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )


def upsert_chunks(chunks: list[dict[str, Any]], batch_size: int = 50) -> int:
    """Embed and upsert chunks into Pinecone."""
    if not chunks:
        return 0

    ensure_index_exists()
    index = get_index()
    total = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c["text"] for c in batch]
        embeddings = embed_texts(texts)

        vectors = [
            {
                "id": chunk["id"],
                "values": embedding,
                "metadata": {**chunk["metadata"], "text": chunk["text"][:1000]},
            }
            for chunk, embedding in zip(batch, embeddings)
        ]

        index.upsert(vectors=vectors)
        total += len(vectors)

    return total


def query_vectors(
    query_embedding: list[float],
    top_k: int = 6,
    filter_dict: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Query Pinecone and return matches with metadata."""
    index = get_index()
    result = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict,
    )

    matches = []
    for match in result.matches or []:
        meta = dict(match.metadata or {})
        matches.append(
            {
                "id": match.id,
                "score": match.score,
                "metadata": meta,
            }
        )
    return matches


def get_index_stats() -> dict[str, Any]:
    index = get_index()
    stats = index.describe_index_stats()
    namespaces: dict[str, Any] = {}
    if stats.namespaces:
        for name, ns in stats.namespaces.items():
            namespaces[name] = {"vector_count": ns.vector_count}
    return {
        "total_vectors": stats.total_vector_count,
        "namespaces": namespaces,
    }


def metadata_to_car(meta: dict[str, Any]) -> dict[str, Any]:
    """Convert Pinecone metadata back to a car object for the UI."""
    images: list[str] = []
    raw = meta.get("images_json")
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(parsed, list):
                images = [img for img in parsed if isinstance(img, str)]
        except (json.JSONDecodeError, TypeError):
            pass

    if not images and meta.get("image_url"):
        images = [meta["image_url"]]

    return {
        "vehicleId": meta.get("vehicle_id", ""),
        "title": meta.get("title", ""),
        "make": meta.get("make", ""),
        "model": meta.get("model", ""),
        "variant": meta.get("variant", ""),
        "year": meta.get("year") or None,
        "price": meta.get("price", ""),
        "originalPrice": meta.get("original_price", ""),
        "emi": meta.get("emi", ""),
        "mileage": meta.get("mileage", ""),
        "fuel": meta.get("fuel", ""),
        "transmission": meta.get("transmission", ""),
        "rto": meta.get("rto", ""),
        "owners": meta.get("owners", ""),
        "location": meta.get("location", ""),
        "badge": meta.get("badge", ""),
        "detailUrl": meta.get("detail_url", ""),
        "imageUrl": meta.get("image_url", ""),
        "images": images,
    }

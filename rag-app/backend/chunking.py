"""Convert Cars24 vehicle records into RAG chunks with rich metadata."""

from __future__ import annotations

import json
from typing import Any


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def build_vehicle_text(vehicle: dict[str, Any]) -> str:
    """Build searchable text content for a single vehicle chunk."""
    parts: list[str] = []

    title = _clean(vehicle.get("title"))
    if title:
        parts.append(f"Vehicle: {title}")

    make = _clean(vehicle.get("make"))
    model = _clean(vehicle.get("model"))
    variant = _clean(vehicle.get("variant"))
    if make or model:
        parts.append(f"Make/Model: {' '.join(filter(None, [make, model, variant]))}")

    year = vehicle.get("year")
    if year:
        parts.append(f"Year: {year}")

    price = _clean(vehicle.get("price"))
    if price:
        parts.append(f"Price: {price}")

    original = _clean(vehicle.get("originalPrice"))
    if original:
        parts.append(f"Original price: {original}")

    emi = _clean(vehicle.get("emi"))
    if emi:
        parts.append(f"EMI: {emi}")

    mileage = _clean(vehicle.get("mileage"))
    if mileage:
        parts.append(f"Mileage: {mileage}")

    fuel = _clean(vehicle.get("fuel"))
    if fuel:
        parts.append(f"Fuel: {fuel}")

    transmission = _clean(vehicle.get("transmission"))
    if transmission:
        parts.append(f"Transmission: {transmission}")

    rto = _clean(vehicle.get("rto"))
    if rto:
        parts.append(f"RTO: {rto}")

    owners = _clean(vehicle.get("owners"))
    if owners:
        parts.append(f"Owners: {owners}")

    location = _clean(vehicle.get("location"))
    if location:
        parts.append(f"Location: {location}")

    badge = _clean(vehicle.get("badge"))
    if badge:
        parts.append(f"Badge: {badge}")

    detail_url = _clean(vehicle.get("detailUrl"))
    if detail_url:
        parts.append(f"Listing URL: {detail_url}")

    return "\n".join(parts)


def build_metadata(vehicle: dict[str, Any]) -> dict[str, Any]:
    """Build Pinecone metadata — scalar fields + serialized images array."""
    vehicle_id = _clean(vehicle.get("vehicleId"))
    if not vehicle_id:
        raise ValueError("vehicleId is required for indexing")

    images: list[str] = []
    raw_images = vehicle.get("images")
    if isinstance(raw_images, list):
        images = [img for img in raw_images if isinstance(img, str) and img.strip()][:10]
    elif _clean(vehicle.get("imageUrl")):
        images = [_clean(vehicle.get("imageUrl"))]  # type: ignore[list-item]

    image_url = images[0] if images else _clean(vehicle.get("imageUrl"))

    metadata: dict[str, Any] = {
        "vehicle_id": vehicle_id,
        "title": _clean(vehicle.get("title")) or "",
        "make": _clean(vehicle.get("make")) or "",
        "model": _clean(vehicle.get("model")) or "",
        "variant": _clean(vehicle.get("variant")) or "",
        "year": int(vehicle["year"]) if vehicle.get("year") else 0,
        "price": _clean(vehicle.get("price")) or "",
        "original_price": _clean(vehicle.get("originalPrice")) or "",
        "emi": _clean(vehicle.get("emi")) or "",
        "mileage": _clean(vehicle.get("mileage")) or "",
        "fuel": _clean(vehicle.get("fuel")) or "",
        "transmission": _clean(vehicle.get("transmission")) or "",
        "rto": _clean(vehicle.get("rto")) or "",
        "owners": _clean(vehicle.get("owners")) or "",
        "location": _clean(vehicle.get("location")) or "",
        "badge": _clean(vehicle.get("badge")) or "",
        "detail_url": _clean(vehicle.get("detailUrl")) or "",
        "image_url": image_url or "",
        "images_json": json.dumps(images),
        "source": _clean(vehicle.get("source")) or "listing",
        "chunk_type": "vehicle_summary",
    }

    return metadata


def vehicle_to_chunk(vehicle: dict[str, Any]) -> dict[str, Any]:
    """One vehicle → one chunk (cars are compact; keeps retrieval precise)."""
    vehicle_id = _clean(vehicle.get("vehicleId"))
    if not vehicle_id:
        raise ValueError("vehicleId is required")

    return {
        "id": f"vehicle-{vehicle_id}",
        "text": build_vehicle_text(vehicle),
        "metadata": build_metadata(vehicle),
    }


def vehicles_to_chunks(vehicles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate by vehicleId and convert to chunks."""
    seen: set[str] = set()
    chunks: list[dict[str, Any]] = []

    for vehicle in vehicles:
        vid = _clean(vehicle.get("vehicleId"))
        if not vid or vid in seen:
            continue
        seen.add(vid)
        chunks.append(vehicle_to_chunk(vehicle))

    return chunks

"""Load Cars24 vehicle data from JSON or CSV exports."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

INT_FIELDS = {"year"}
NULLABLE_FIELDS = {
    "vehicleId",
    "title",
    "make",
    "model",
    "variant",
    "detailUrl",
    "price",
    "originalPrice",
    "emi",
    "mileage",
    "fuel",
    "transmission",
    "rto",
    "owners",
    "location",
    "badge",
    "imageUrl",
    "scrapedAt",
    "detailScrapedAt",
    "source",
    "fetchError",
}


def _normalize_value(key: str, value: Any) -> Any:
    if value is None:
        return None

    text = str(value).strip()
    if text == "":
        return None

    if key in INT_FIELDS:
        try:
            return int(float(text))
        except (ValueError, TypeError):
            return None

    return text


def normalize_vehicle(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw record into the canonical vehicle dict for chunking."""
    vehicle: dict[str, Any] = {}

    for key in NULLABLE_FIELDS:
        if key in raw:
            vehicle[key] = _normalize_value(key, raw.get(key))

    # CSV exports only have imageUrl — promote to images list for the UI
    image_url = vehicle.get("imageUrl")
    if image_url and not vehicle.get("images"):
        vehicle["images"] = [image_url]

    return vehicle


def load_vehicles_from_json(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("JSON file must contain an array of vehicles")

    return [normalize_vehicle(v) for v in data if isinstance(v, dict)]


def load_vehicles_from_csv(path: Path) -> list[dict[str, Any]]:
    """Parse Chrome extension CSV export (handles quoted commas in fields)."""
    vehicles: list[dict[str, Any]] = []

    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV file has no header row")

        for row in reader:
            vehicles.append(normalize_vehicle(row))

    return vehicles


def load_vehicles(path: Path) -> list[dict[str, Any]]:
    """Auto-detect format from file extension."""
    suffix = path.suffix.lower()

    if suffix == ".json":
        return load_vehicles_from_json(path)
    if suffix == ".csv":
        return load_vehicles_from_csv(path)

    raise ValueError(f"Unsupported file type: {suffix}. Use .json or .csv")

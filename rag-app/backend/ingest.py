#!/usr/bin/env python3
"""CLI to ingest Cars24 JSON/CSV exports into Pinecone.

Usage:
  python ingest.py path/to/cars24-vehicles.json
  python ingest.py path/to/cars24-vehicles.csv
  python ingest.py --csv      # ingest bundled CSV from data/
  python ingest.py --sample   # ingest bundled sample JSON
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from chunking import vehicles_to_chunks
from loaders import load_vehicles
from pinecone_store import ensure_index_exists, get_index_stats, upsert_chunks

DATA_DIR = Path(__file__).parent.parent / "data"
SAMPLE_PATH = DATA_DIR / "sample-vehicles.json"
DEFAULT_CSV_PATH = DATA_DIR / "cars24-vehicles-2026-06-07-08-41-36.csv"


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest Cars24 vehicles into Pinecone")
    parser.add_argument("data_file", nargs="?", help="Path to exported .json or .csv file")
    parser.add_argument("--sample", action="store_true", help="Ingest bundled sample JSON")
    parser.add_argument("--csv", action="store_true", help="Ingest bundled CSV from data/")
    args = parser.parse_args()

    if args.csv:
        path = DEFAULT_CSV_PATH
    elif args.sample:
        path = SAMPLE_PATH
    elif args.data_file:
        path = Path(args.data_file)
    else:
        path = DEFAULT_CSV_PATH
        print(f"No file specified — using default: {path.name}")

    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        return 1

    print(f"Loading vehicles from {path}...")
    vehicles = load_vehicles(path)
    print(f"  Found {len(vehicles)} records")

    chunks = vehicles_to_chunks(vehicles)
    print(f"  Prepared {len(chunks)} unique chunks")

    print("Ensuring Pinecone index exists...")
    ensure_index_exists()

    print("Embedding and upserting...")
    indexed = upsert_chunks(chunks)
    print(f"  Indexed {indexed} vectors")

    stats = get_index_stats()
    print(f"  Index total vectors: {stats['total_vectors']}")
    print("Done!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

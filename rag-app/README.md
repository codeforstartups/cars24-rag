# Cars24 RAG Application

A RAG (Retrieval Augmented Generation) app that indexes Cars24 vehicle data in **Pinecone** and provides an AI chat interface with car photos and detail links.

## Architecture

```
Chrome Extension (crawl) → Export JSON → Ingest → Pinecone
                                              ↓
                                    Chat UI ← FastAPI RAG API
```

## Prerequisites

1. **Pinecone account** — [pinecone.io](https://www.pinecone.io) (free tier works)
2. **OpenAI API key** — for embeddings + chat
3. **Python 3.11+** and **Node.js 18+**

## Quick Start

### 1. Backend setup

```bash
cd rag-app/backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
```

### 2. Index vehicle data

Export JSON or CSV from the Chrome extension, then:

```bash
# Bundled CSV (575 cars from your crawl)
python ingest.py --csv

# Or specify any export file
python ingest.py ../data/cars24-vehicles-2026-06-07-08-41-36.csv
python ingest.py /path/to/cars24-vehicles.json

# Sample JSON (5 demo cars)
python ingest.py --sample
```

The ingest script will:
- Create the Pinecone index `cars24-vehicles` if it doesn't exist
- Chunk each vehicle into one searchable document
- Attach metadata (make, model, price, images, detail URL, etc.)
- Embed with OpenAI `text-embedding-3-small` and upsert to Pinecone

### 3. Start the API server

```bash
uvicorn main:app --reload --port 8000
```

### 4. Start the chat UI

```bash
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Chunking & Metadata

Each vehicle becomes **one chunk** with:

| Metadata field | Purpose |
|----------------|---------|
| `vehicle_id` | Unique ID, used as vector ID |
| `title`, `make`, `model`, `variant` | Display + filtering |
| `year`, `price`, `mileage`, `fuel`, `transmission` | Search + filters |
| `location`, `owners`, `rto`, `badge` | Context |
| `detail_url` | Link to Cars24 listing |
| `image_url` | Primary thumbnail |
| `images_json` | Up to 10 photo URLs (JSON array) |
| `text` | Searchable content for RAG context |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + index stats |
| POST | `/chat` | RAG chat query |
| POST | `/ingest` | Upload JSON file |
| GET | `/stats` | Pinecone index stats |

### Chat request example

```json
{
  "message": "Show me petrol cars under 5 lakh in Delhi",
  "history": [],
  "top_k": 6
}
```

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | — |
| `PINECONE_API_KEY` | Yes | — |
| `PINECONE_INDEX_NAME` | No | `cars24-vehicles` |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` |
| `CHAT_MODEL` | No | `gpt-4o-mini` |

## Tips

- Always export **JSON** (not CSV) — CSV drops the `images[]` array
- Enable **detail page fetch** in the crawler for richer data and multiple photos
- Re-run `ingest.py` after new crawls — it upserts by `vehicleId` (no duplicates)

"""FastAPI server for Cars24 RAG chat and ingestion."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from chunking import vehicles_to_chunks
from loaders import load_vehicles
from config import settings
from pinecone_store import ensure_index_exists, get_index_stats, upsert_chunks
from rag import chat, chat_stream, health_info

app = FastAPI(title="Cars24 RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)
    top_k: int = Field(default=6, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    cars: list[dict[str, Any]]
    sources_count: int


class IngestResponse(BaseModel):
    ok: bool
    vehicles_received: int
    chunks_indexed: int
    message: str


@app.get("/health")
def health():
    return {"status": "ok", **health_info()}


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    try:
        history = [{"role": m.role, "content": m.content} for m in req.history]
        result = chat(req.message, history=history, top_k=req.top_k)
        return ChatResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/chat/stream")
def chat_stream_endpoint(req: ChatRequest):
    """SSE stream: car events first, then token events, then done."""
    try:
        history = [{"role": m.role, "content": m.content} for m in req.history]

        def generate():
            yield from chat_stream(req.message, history=history, top_k=req.top_k)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/ingest", response_model=IngestResponse)
async def ingest_file(file: UploadFile = File(...)):
    """Upload a Cars24 JSON or CSV export from the Chrome extension."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".json", ".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .json or .csv file")

    try:
        raw = await file.read()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)
        vehicles = load_vehicles(tmp_path)
        tmp_path.unlink(missing_ok=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}") from exc

    try:
        ensure_index_exists()
        chunks = vehicles_to_chunks(vehicles)
        indexed = upsert_chunks(chunks)
        return IngestResponse(
            ok=True,
            vehicles_received=len(vehicles),
            chunks_indexed=indexed,
            message=f"Successfully indexed {indexed} vehicles into Pinecone.",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/ingest/path", response_model=IngestResponse)
def ingest_from_path(body: dict[str, str]):
    """Ingest from a local JSON or CSV file path (for CLI/dev use)."""
    path_str = body.get("path", "")
    if not path_str:
        raise HTTPException(status_code=400, detail="path is required")

    path = Path(path_str)
    try:
        vehicles = load_vehicles(path)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ensure_index_exists()
    chunks = vehicles_to_chunks(vehicles)
    indexed = upsert_chunks(chunks)
    return IngestResponse(
        ok=True,
        vehicles_received=len(vehicles),
        chunks_indexed=indexed,
        message=f"Indexed {indexed} vehicles from {path}",
    )


@app.get("/stats")
def stats():
    try:
        return {"ok": True, **get_index_stats()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

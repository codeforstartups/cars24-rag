import type { Car, ChatResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, top_k: 6 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to get response");
  }

  return res.json();
}

export interface StreamCallbacks {
  onCar: (car: Car) => void;
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChatMessage(
  message: string,
  history: { role: string; content: string }[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, top_k: 6 }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    callbacks.onError(new Error(err.detail || "Failed to stream response"));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response stream"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;

        const lines = part.split("\n");
        let event = "message";
        let data = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data = line.slice(6);
        }

        if (!data) continue;

        try {
          if (event === "car") {
            callbacks.onCar(JSON.parse(data) as Car);
          } else if (event === "token") {
            const parsed = JSON.parse(data) as { text: string };
            callbacks.onToken(parsed.text);
          } else if (event === "done") {
            callbacks.onDone();
          }
        } catch {
          // skip malformed events
        }
      }
    }
    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error("Stream failed"));
  }
}

export async function checkHealth(): Promise<{
  status: string;
  openai_configured: boolean;
  pinecone_configured: boolean;
  index_stats?: { total_vectors: number };
}> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

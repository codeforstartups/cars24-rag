import { useEffect, useState } from "react";
import { Car, Database, Upload } from "lucide-react";
import { checkHealth } from "./api";
import { Chat } from "./components/Chat";

export default function App() {
  const [health, setHealth] = useState<{
    openai_configured: boolean;
    pinecone_configured: boolean;
    total_vectors?: number;
  } | null>(null);

  useEffect(() => {
    checkHealth()
      .then((h) =>
        setHealth({
          openai_configured: h.openai_configured,
          pinecone_configured: h.pinecone_configured,
          total_vectors: h.index_stats?.total_vectors,
        })
      )
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <header className="shrink-0 border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-md">
              <Car className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Cars24 AI</h1>
              <p className="text-xs text-slate-500">Powered by RAG + Pinecone</p>
            </div>
          </div>

          {health && (
            <div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                {health.total_vectors != null
                  ? `${health.total_vectors.toLocaleString()} cars indexed`
                  : "Index not ready"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  health.openai_configured && health.pinecone_configured
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {health.openai_configured && health.pinecone_configured
                  ? "Connected"
                  : "Setup required"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Chat />
      </main>

      <footer className="shrink-0 border-t border-slate-100 bg-white/50 px-4 py-2 text-center text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Upload className="h-3 w-3" />
          Export JSON from the Chrome extension, then run{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">
            python ingest.py your-export.json
          </code>{" "}
          to index new listings
        </span>
      </footer>
    </div>
  );
}

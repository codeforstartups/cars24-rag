import { useEffect, useState } from "react";
import { Car, Sparkles } from "lucide-react";
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

  const connected =
    health?.openai_configured && health?.pinecone_configured;

  return (
    <div className="app-bg flex h-screen flex-col">
      <header className="shrink-0 border-b border-white/10 bg-ink-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
              <Car className="h-5 w-5 text-white" strokeWidth={2.5} />
              <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                <Sparkles className="h-2.5 w-2.5 text-brand-500" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                Cars24 AI
              </h1>
              <p className="text-[11px] font-medium text-slate-400">
                Smart car search assistant
              </p>
            </div>
          </div>

          {health && (
            <div className="flex items-center gap-2">
              {health.total_vectors != null && (
                <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 sm:inline">
                  {health.total_vectors.toLocaleString()} cars
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  connected
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                {connected ? "Live" : "Offline"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Chat />
      </main>
    </div>
  );
}

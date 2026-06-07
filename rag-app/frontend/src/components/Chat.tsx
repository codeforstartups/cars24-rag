import { useEffect, useRef, useState } from "react";
import {
  Car,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { streamChatMessage } from "../api";
import {
  buildHistoryPayload,
  clearStoredMessages,
  loadStoredMessages,
  useChatStorage,
} from "../hooks/useChatStorage";
import type { Car as CarType, ChatMessage } from "../types";
import { CarSlider } from "./CarSlider";

const SUGGESTIONS = [
  { icon: "⛽", text: "Petrol cars under ₹5 lakh" },
  { icon: "🏙️", text: "Automatic SUVs in Delhi NCR" },
  { icon: "✅", text: "1st owner diesel cars" },
  { icon: "⭐", text: "Best value Maruti Swift" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function updateMessage(
  messages: ChatMessage[],
  id: string,
  updater: (msg: ChatMessage) => ChatMessage
): ChatMessage[] {
  return messages.map((m) => (m.id === id ? updater(m) : m));
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useChatStorage(messages);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const assistantId = uid();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      cars: [],
      timestamp: new Date(),
      isStreaming: true,
    };

    const history = buildHistoryPayload(messages);

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput("");
    setLoading(true);

    await streamChatMessage(
      trimmed,
      history,
      {
        onCar: (car: CarType) => {
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => ({
              ...m,
              cars: [...(m.cars || []), car],
            }))
          );
        },
        onToken: () => {},
        onDone: () => {
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => ({
              ...m,
              isStreaming: false,
            }))
          );
          setLoading(false);
          inputRef.current?.focus();
        },
        onError: (err) => {
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => ({
              ...m,
              content: err.message,
              isStreaming: false,
            }))
          );
          setLoading(false);
        },
      },
      controller.signal
    );
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
    clearStoredMessages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center animate-fade-in sm:py-16">
            <div className="relative mb-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
                <Car className="h-10 w-10 text-white" strokeWidth={2} />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 shadow-lg">
                <Sparkles className="h-4 w-4 text-brand-400" />
              </div>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Find your perfect
              <span className="text-gradient"> used car</span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
              Search 575+ Cars24 listings by budget, fuel, location & more.
              Swipe through matches instantly.
            </p>

            <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => submit(s.text)}
                  className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-200"
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-sm font-semibold text-ink-800 group-hover:text-brand-700">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-8">
            {messages.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition hover:text-slate-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  New search
                </button>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === "user" ? "flex justify-end animate-slide-up" : "animate-slide-up"}
              >
                {msg.role === "user" ? (
                  <div className="flex max-w-[85%] items-end gap-2">
                    <div className="rounded-2xl rounded-br-sm bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-md">
                      {msg.content}
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
                      <MessageCircle className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ) : msg.isStreaming && (msg.cars?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-8 py-14 shadow-card ring-1 ring-slate-100">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border-4 border-slate-100" />
                      <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-brand-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-ink-800">Searching listings</p>
                      <p className="mt-1 text-xs text-slate-400">Scanning 575 cars in Pinecone…</p>
                    </div>
                  </div>
                ) : (msg.cars?.length ?? 0) > 0 ? (
                  <CarSlider cars={msg.cars!} streaming={msg.isStreaming} />
                ) : msg.content ? (
                  <div className="rounded-2xl bg-red-50 px-5 py-4 text-center text-sm font-medium text-red-600 ring-1 ring-red-100">
                    {msg.content}
                  </div>
                ) : (
                  <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-card ring-1 ring-slate-100">
                    <Search className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-ink-800">No matches found</p>
                    <p className="mt-1 text-xs text-slate-400">Try a different budget or location</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2 sm:px-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-end gap-2.5 rounded-2xl bg-white p-2 shadow-input ring-1 ring-slate-200/80">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search cars — e.g. diesel under 6 lakh in Gurgaon"
              rows={1}
              disabled={loading}
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm font-medium text-ink-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 112) + "px";
              }}
            />
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md transition-all hover:from-brand-600 hover:to-brand-700 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:shadow-none"
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
            AI-powered search · Remembers your conversation
          </p>
        </div>
      </div>
    </div>
  );
}

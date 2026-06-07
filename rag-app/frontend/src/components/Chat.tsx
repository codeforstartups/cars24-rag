import { useEffect, useRef, useState } from "react";
import { Car, Loader2, Send, Trash2 } from "lucide-react";
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
  "Show me petrol cars under ₹5 lakh",
  "Any automatic SUVs in Bangalore?",
  "Find 1st owner diesel cars",
  "Best value Maruti cars available",
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
      {messages.length > 0 && (
        <div className="flex justify-end px-4 pt-2 sm:px-6">
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear chat
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-200">
              <Car className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Find your perfect used car
            </h2>
            <p className="mt-2 max-w-md text-slate-500">
              Ask me anything about Cars24 listings. I'll remember our conversation
              and show matching cars in a swipeable gallery.
            </p>
            <div className="mt-8 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md space-y-8 sm:max-w-lg">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`animate-slide-up ${
                  msg.role === "user" ? "flex justify-end" : ""
                }`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm text-white">
                    {msg.content}
                  </div>
                ) : msg.isStreaming && (msg.cars?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center gap-3 py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                    <span className="text-sm text-slate-500">Finding matching cars…</span>
                  </div>
                ) : (msg.cars?.length ?? 0) > 0 ? (
                  <CarSlider cars={msg.cars!} streaming={msg.isStreaming} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                    No matching cars found. Try a different search.
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about cars — follow-ups work too, e.g. 'which one is cheapest?'"
              rows={1}
              disabled={loading}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
              style={{ minHeight: "48px", maxHeight: "120px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || loading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md transition-all hover:from-brand-600 hover:to-brand-700 hover:shadow-lg disabled:opacity-40 disabled:shadow-none"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

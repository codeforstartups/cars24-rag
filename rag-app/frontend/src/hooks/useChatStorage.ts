import { useEffect, useRef } from "react";
import type { Car, ChatMessage } from "../types";

const STORAGE_KEY = "cars24-chat-messages";

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cars?: Car[];
  timestamp: string;
  isStreaming?: boolean;
}

export function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredMessage[] = JSON.parse(raw);
    return parsed
      .filter((m) => !m.isStreaming)
      .map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]) {
  const toStore: StoredMessage[] = messages
    .filter((m) => !m.isStreaming)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      cars: m.cars,
      timestamp: m.timestamp.toISOString(),
    }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function clearStoredMessages() {
  localStorage.removeItem(STORAGE_KEY);
}

export function buildHistoryPayload(messages: ChatMessage[]) {
  return messages
    .filter((m) => {
      if (m.isStreaming) return false;
      if (m.role === "user") return m.content.trim().length > 0;
      return (m.cars?.length ?? 0) > 0 || m.content.trim().length > 0;
    })
    .map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.cars?.length
          ? `[Cars shown: ${m.cars
              .map(
                (c, i) =>
                  `#${i + 1} ${c.title} | ${c.price} | ${c.mileage} | ${c.fuel} | ${c.location}`
              )
              .join(" ; ")}]`
          : m.content,
    }));
}

export function useChatStorage(messages: ChatMessage[]) {
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    saveMessages(messages);
  }, [messages]);
}

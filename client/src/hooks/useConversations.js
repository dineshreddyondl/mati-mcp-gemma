/**
 * useConversations.js
 * Manages named conversations in localStorage.
 * Auto-generates titles from first message.
 */
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "mati_conversations";

function generateId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function truncate(text, max = 40) {
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConversations(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist to localStorage whenever conversations change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // ignore storage errors
    }
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  const newConversation = useCallback((mode = "internal") => {
    const id = generateId();
    const conv = {
      id,
      title: "New conversation",
      mode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const addMessage = useCallback((convId, message) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const messages = [...c.messages, message];
        // Auto-generate title from first user message
        let title = c.title;
        if (title === "New conversation" && message.role === "user") {
          title = truncate(message.content);
        }
        return { ...c, messages, title, updatedAt: Date.now() };
      })
    );
  }, []);

  const updateMode = useCallback((convId, mode) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, mode } : c))
    );
  }, []);

  const deleteConversation = useCallback((convId) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      if (activeId === convId) {
        setActiveId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [activeId]);

  const selectConversation = useCallback((id) => {
    setActiveId(id);
  }, []);

  // Group conversations by date
  const grouped = (() => {
    const now = Date.now();
    const day = 86400000;
    const groups = { Today: [], Yesterday: [], "This week": [], Older: [] };
    conversations.forEach((c) => {
      const age = now - c.updatedAt;
      if (age < day) groups.Today.push(c);
      else if (age < 2 * day) groups.Yesterday.push(c);
      else if (age < 7 * day) groups["This week"].push(c);
      else groups.Older.push(c);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  })();

  return {
    conversations,
    grouped,
    activeId,
    activeConversation,
    newConversation,
    addMessage,
    updateMode,
    deleteConversation,
    selectConversation,
  };
}

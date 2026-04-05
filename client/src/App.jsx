/**
 * App.jsx — Mati main app.
 * Wires together Header, Sidebar, ChatArea, InputBar.
 * Manages conversations, mode, dark mode, API calls.
 */
import { useState, useEffect } from "react";
import Header, { MODES } from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatArea from "./components/ChatArea.jsx";
import InputBar from "./components/InputBar.jsx";
import { useConversations } from "./hooks/useConversations.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [mode, setMode] = useState("internal");
  const [health, setHealth] = useState({ status: "checking", model: "Gemma 3 8B" });
  const [loading, setLoading] = useState(false);
  const [queueInfo, setQueueInfo] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);

  const {
    grouped, activeId, activeConversation,
    newConversation, addMessage, updateMode,
    deleteConversation, selectConversation,
  } = useConversations();

  // Fetch health on mount
  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth({ status: "error", model: "Offline" }));
  }, []);

  // Start a new conversation on first load if none exist
  useEffect(() => {
    if (!activeId) newConversation(mode);
  }, []);

  // Sync mode to active conversation
  useEffect(() => {
    if (activeConversation && activeConversation.mode !== mode) {
      setMode(activeConversation.mode);
    }
  }, [activeId]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (activeId) updateMode(activeId, newMode);
  };

  const handleNewChat = () => {
    const id = newConversation(mode);
    setDocumentContent(null);
  };

  const handleSelectConversation = (id) => {
    selectConversation(id);
    setDocumentContent(null);
  };

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;

    // Ensure there's an active conversation
    const convId = activeId || newConversation(mode);

    const userMsg = { role: "user", content: text, mode };
    addMessage(convId, userMsg);
    setLoading(true);
    setQueueInfo(null);

    try {
      const history = activeConversation
        ? [...activeConversation.messages, userMsg]
        : [userMsg];

      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          mode,
          documentContent: mode === "document" ? documentContent : undefined,
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.queuePosition > 0) {
        setQueueInfo({ position: data.queuePosition, estimatedWait: data.estimatedWait });
      }

      addMessage(convId, {
        role: "assistant",
        content: data.content,
        mode,
        toolsUsed: data.toolsUsed,
      });
    } catch (err) {
      addMessage(convId, {
        role: "assistant",
        content: `Something went wrong: ${err.message}`,
        mode,
      });
    } finally {
      setLoading(false);
      setQueueInfo(null);
    }
  };

  const messages = activeConversation?.messages || [];
  const bg = dark ? "#0f172a" : "#f8fafc";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        model={health.model}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          grouped={grouped}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={deleteConversation}
          dark={dark}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Mode context bar */}
          <ModeContextBar mode={mode} dark={dark} />

          <ChatArea
            messages={messages}
            loading={loading}
            queueInfo={queueInfo}
            mode={mode}
            dark={dark}
          />

          <InputBar
            mode={mode}
            onSend={handleSend}
            loading={loading}
            dark={dark}
            onDocumentLoad={(content) => setDocumentContent(content)}
          />
        </div>
      </div>
    </div>
  );
}

function ModeContextBar({ mode, dark }) {
  const meta = {
    internal: {
      text: "Internal data mode — queries run against ONDL MongoDB",
      bg: dark ? "#0c1626" : "#eff6ff",
      color: dark ? "#60a5fa" : "#1d4ed8",
    },
    general: {
      text: "General mode — ask anything, no database access",
      bg: dark ? "#052e16" : "#f0fdf4",
      color: dark ? "#4ade80" : "#166534",
    },
    document: {
      text: "Document mode — upload a file and ask questions about it",
      bg: dark ? "#1c1400" : "#fffbeb",
      color: dark ? "#fbbf24" : "#92400e",
    },
  }[mode];

  return (
    <div style={{
      padding: "5px 16px", fontSize: 11,
      background: meta.bg, color: meta.color,
      borderBottom: `0.5px solid ${dark ? "#334155" : "#e2e8f0"}`,
      flexShrink: 0,
    }}>
      {meta.text}
    </div>
  );
}

/**
 * App.jsx — Su-Mati main app.
 * Features: 3 modes with isolated chat views, Mac Mini health check,
 * localStorage conversation history, queue handling.
 */
import { useState, useEffect } from "react";
import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatArea from "./components/ChatArea.jsx";
import InputBar from "./components/InputBar.jsx";
import { useConversations } from "./hooks/useConversations.js";

const API_URL = import.meta.env.VITE_API_URL || "";

const CTX_BAR = {
  internal: { bg: "#eff6ff", darkBg: "#0c1626", color: "#1d4ed8", darkColor: "#60a5fa", text: "ONDL Order Reporting — queries run directly against ONDL MongoDB" },
  general:  { bg: "#f0fdf4", darkBg: "#052e16", color: "#16a34a", darkColor: "#4ade80", text: "General context — ask anything, no database access" },
  document: { bg: "#fffbeb", darkBg: "#1c1400", color: "#d97706", darkColor: "#fbbf24", text: "Document analysis — upload a file and ask questions about its content" },
};

export default function App() {
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState("internal");
  const [macOnline, setMacOnline] = useState(true);
  const [modelName, setModelName] = useState("Google Gemma");
  const [loading, setLoading] = useState(false);
  const [queueInfo, setQueueInfo] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);

  const {
    grouped, activeId, activeConversation,
    newConversation, addMessage, updateMode,
    deleteConversation, selectConversation,
  } = useConversations();

  // Health check every 30 seconds
  useEffect(() => {
    const check = () => {
      fetch(`${API_URL}/api/health`)
        .then(r => r.json())
        .then(d => {
          setMacOnline(d.status === "ok");
          if (d.model) setModelName(d.model);
        })
        .catch(() => setMacOnline(false));
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  // Start first conversation on mount
  useEffect(() => {
    if (!activeId) newConversation(mode);
  }, []);

  // Sync mode when switching conversations
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
    newConversation(mode);
    setDocumentContent(null);
  };

  const handleSelectConversation = (id) => {
    selectConversation(id);
    setDocumentContent(null);
  };

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;
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
          messages: history.map(m => ({ role: m.role, content: m.content })),
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
  const ctx = CTX_BAR[mode];
  const bg = dark ? "#0d1117" : "#f0f2f5";
  const border = dark ? "#30363d" : "#e5e7eb";

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: bg, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        macOnline={macOnline}
      />

      {/* Offline banner */}
      {!macOnline && (
        <div style={{
          background: dark ? "#1a0505" : "#fef2f2",
          borderBottom: `0.5px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
          padding: "8px 20px", fontSize: 12,
          color: dark ? "#f87171" : "#dc2626",
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 5v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Mac Mini appears to be offline — Su-Mati is unreachable. Please check the server and restart the process manager.
        </div>
      )}

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
          {/* Context bar */}
          <div style={{
            padding: "5px 20px", fontSize: 11, fontWeight: 500,
            background: dark ? ctx.darkBg : ctx.bg,
            color: dark ? ctx.darkColor : ctx.color,
            borderBottom: `0.5px solid ${border}`,
            flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
          }}>
            {ctx.text}
          </div>

          <ChatArea
            messages={messages}
            loading={loading}
            queueInfo={queueInfo}
            mode={mode}
            dark={dark}
            onSuggestion={(s) => handleSend(s)}
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

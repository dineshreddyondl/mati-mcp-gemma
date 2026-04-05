import { useState, useEffect, useRef } from "react";

// In production (Mac Mini), API is on the same host
// In dev (MacBook), set VITE_API_URL in client/.env.local to point to Mac Mini
const API_URL = import.meta.env.VITE_API_URL || "";

function ModelBadge({ model, status }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, color: status === "ok" ? "#16a34a" : "#dc2626",
      background: status === "ok" ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${status === "ok" ? "#bbf7d0" : "#fecaca"}`,
      borderRadius: 6, padding: "3px 10px"
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: status === "ok" ? "#16a34a" : "#dc2626",
        display: "inline-block"
      }} />
      {status === "ok" ? model : "Ollama offline"}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16
    }}>
      <div style={{
        maxWidth: "75%",
        background: isUser ? "#1d4ed8" : "var(--msg-bg, #f1f5f9)",
        color: isUser ? "#fff" : "inherit",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "10px 16px",
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>
        {msg.content}
        {msg.toolsUsed?.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.6 }}>
            Used: {msg.toolsUsed.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ status: "checking", model: "...", database: "" });
  const [darkMode, setDarkMode] = useState(false);
  const bottomRef = useRef(null);

  // Check health on mount
  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(r => r.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: "error", model: "offline", database: "" }));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.content,
        toolsUsed: data.toolsUsed
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Something went wrong: ${err.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const surface = darkMode ? "#1e293b" : "#ffffff";
  const border = darkMode ? "#334155" : "#e2e8f0";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const msgBg = darkMode ? "#1e293b" : "#f1f5f9";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: bg, color: text, fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${border}`, background: surface, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>Mati</span>
          <span style={{ fontSize: 13, color: darkMode ? "#94a3b8" : "#64748b" }}>ONDL Data Reporter</span>
          {health.database && (
            <span style={{ fontSize: 11, color: darkMode ? "#64748b" : "#94a3b8" }}>
              db: {health.database}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ModelBadge model={health.model} status={health.status} />
          <button
            onClick={() => setDarkMode(d => !d)}
            style={{ background: "none", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: text, fontSize: 13 }}
          >
            {darkMode ? "Light" : "Dark"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{ background: "none", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: text, fontSize: 13 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", "--msg-bg": msgBg }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 80, color: darkMode ? "#475569" : "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: darkMode ? "#94a3b8" : "#64748b" }}>Ask Mati anything about ONDL orders</div>
            <div style={{ fontSize: 13, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
              {["How many orders this month?", "Revenue by company", "Order status breakdown", "Show latest 5 orders"].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{
                  background: surface, border: `1px solid ${border}`,
                  borderRadius: 20, padding: "6px 14px", cursor: "pointer",
                  color: text, fontSize: 13
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {loading && (
          <div style={{ display: "flex", gap: 4, padding: "10px 16px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#1d4ed8", opacity: 0.4,
                animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${border}`, background: surface, display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about orders, revenue, delivery rates..."
          disabled={loading}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: 10,
            border: `1px solid ${border}`, background: bg,
            color: text, fontSize: 14, outline: "none"
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: loading || !input.trim() ? (darkMode ? "#334155" : "#e2e8f0") : "#1d4ed8",
            color: loading || !input.trim() ? (darkMode ? "#64748b" : "#94a3b8") : "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer"
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

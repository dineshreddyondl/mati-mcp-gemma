/**
 * ChatArea.jsx — message list with mode tags and queue banner.
 */
import { useEffect, useRef } from "react";

const MODE_META = {
  internal: { label: "Internal data", color: "#1d4ed8", bg: "#eff6ff" },
  general: { label: "General", color: "#16a34a", bg: "#f0fdf4" },
  document: { label: "Document", color: "#d97706", bg: "#fffbeb" },
};

function QueueBanner({ position, estimatedWait, dark }) {
  return (
    <div style={{
      background: dark ? "#0c1626" : "#eff6ff",
      border: `0.5px solid ${dark ? "#1e3a5f" : "#bfdbfe"}`,
      borderRadius: 10, padding: "10px 14px",
      fontSize: 13, color: dark ? "#93c5fd" : "#1e40af",
      display: "flex", alignItems: "center", gap: 10,
      margin: "0 0 8px", flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ flex: 1 }}>
        Your teammates are already querying Mati — you're position{" "}
        <strong>#{position + 1}</strong>, est.{" "}
        <strong>~{estimatedWait}s</strong>
      </span>
      <div style={{
        width: 80, height: 3,
        background: dark ? "#1e3a5f" : "#bfdbfe",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", background: dark ? "#3b82f6" : "#3b82f6",
          borderRadius: 2, width: "30%",
          animation: "qprog 3s ease-in-out infinite alternate",
        }} />
      </div>
      <style>{`@keyframes qprog{0%{width:15%}100%{width:70%}}`}</style>
    </div>
  );
}

function TypingIndicator({ dark }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#1d4ed8", opacity: 0.5,
          animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

function Message({ msg, dark }) {
  const isUser = msg.role === "user";
  const meta = MODE_META[msg.mode] || MODE_META.internal;

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 4,
    }}>
      <div style={{ maxWidth: "80%" }}>
        {!isUser && msg.mode && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 500,
            color: meta.color,
            background: meta.bg,
            borderRadius: 4, padding: "2px 7px", marginBottom: 5,
          }}>
            {meta.label}
          </div>
        )}
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          background: isUser
            ? "#1d4ed8"
            : dark ? "#1e293b" : "#ffffff",
          border: isUser ? "none" : `0.5px solid ${dark ? "#334155" : "#e2e8f0"}`,
          color: isUser ? "#ffffff" : (dark ? "#f1f5f9" : "#0f172a"),
          fontSize: 13, lineHeight: 1.65,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        {msg.toolsUsed?.length > 0 && (
          <div style={{ fontSize: 11, color: dark ? "#475569" : "#94a3b8", marginTop: 4, paddingLeft: 2 }}>
            Queried: {msg.toolsUsed.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = {
  internal: ["How many orders this month?", "Revenue by company", "Order status breakdown", "Show latest 5 orders"],
  general: ["Help me write an email", "Explain a concept", "Summarize something", "Brainstorm ideas"],
  document: ["Upload a file to get started"],
};

export default function ChatArea({ messages, loading, queueInfo, mode, dark }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const bg = dark ? "#0f172a" : "#f8fafc";
  const muted = dark ? "#475569" : "#94a3b8";
  const surface = dark ? "#1e293b" : "#ffffff";
  const border = dark ? "#334155" : "#e2e8f0";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16, background: bg, display: "flex", flexDirection: "column" }}>
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 36 }}>
            {mode === "internal" ? "📦" : mode === "general" ? "💬" : "📄"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: dark ? "#94a3b8" : "#64748b" }}>
            {mode === "internal" && "Ask Mati about ONDL orders"}
            {mode === "general" && "Ask Mati anything"}
            {mode === "document" && "Upload a document to analyze"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 480 }}>
            {(SUGGESTIONS[mode] || []).map((s) => (
              <div key={s} style={{
                background: surface, border: `0.5px solid ${border}`,
                borderRadius: 20, padding: "6px 14px",
                fontSize: 13, color: dark ? "#94a3b8" : "#64748b", cursor: "default",
              }}>{s}</div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((msg, i) => <Message key={i} msg={msg} dark={dark} />)}
          {loading && queueInfo?.position > 0 && (
            <QueueBanner position={queueInfo.position} estimatedWait={queueInfo.estimatedWait} dark={dark} />
          )}
          {loading && <TypingIndicator dark={dark} />}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

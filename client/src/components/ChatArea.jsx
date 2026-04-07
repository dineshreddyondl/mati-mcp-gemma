/**
 * ChatArea.jsx — messages with mode tags, queue banner, rotating think messages.
 * Shows only messages matching current mode.
 * Fixed scroll: uses chatRef on container instead of scrollIntoView.
 */
import { useEffect, useRef, useState } from "react";

const MODE_META = {
  internal: { label: "Order reporting", color: "#1d4ed8", bg: "#eff6ff" },
  general:  { label: "General", color: "#16a34a", bg: "#f0fdf4" },
  document: { label: "Document", color: "#d97706", bg: "#fffbeb" },
};

const THINK_MSGS = [
  "Working on it, give me a moment...",
  "Digging through your order data...",
  "Running the query on MongoDB...",
  "Crunching the numbers for you...",
  "Pulling the records together...",
  "Nearly done, just a few more seconds...",
  "Almost there — finalising your results...",
];

const GENERAL_THINK_MSGS = [
  "Thinking about your question...",
  "Working on a response...",
  "Almost done...",
];

const DOC_THINK_MSGS = [
  "Reading through your document...",
  "Analysing the content...",
  "Extracting the relevant information...",
  "Almost there...",
];

const SUGGESTIONS = {
  internal: [
    "Month on Month order growth",
    "Customer wise order volume",
    "Destination wise order distribution",
    "Destination with highest order volume",
  ],
  general: [
    "Help me draft a client follow-up email",
    "Summarise this meeting agenda",
    "Explain a logistics concept",
    "Help me prepare a presentation outline",
  ],
  document: [
    "Upload a delivery report PDF",
    "Upload a client invoice",
    "Upload an Excel data export",
    "Upload a contract document",
  ],
};

const LANDING = {
  internal: {
    title: "ONDL AI powered reporting",
    sub: "Ask Su-Mati about deliveries, revenue, client performance and more — running privately on our Mac Mini.",
  },
  general: {
    title: "Ask Su-Mati anything",
    sub: "Write emails, summarise meetings, brainstorm ideas, explain concepts — your general purpose AI assistant.",
  },
  document: {
    title: "Upload a document to analyse",
    sub: "Upload any file — PDF, Excel, CSV, Word, or images — and ask Su-Mati to extract insights, summarise, or answer questions.",
  },
};

function QueueBanner({ position, estimatedWait, dark }) {
  return (
    <div style={{
      background: dark ? "#0c1626" : "#eff6ff",
      border: `0.5px solid ${dark ? "#1e3a5f" : "#bfdbfe"}`,
      borderRadius: 10, padding: "10px 16px",
      fontSize: 13, color: dark ? "#93c5fd" : "#1e40af",
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 8, flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ flex: 1 }}>
        Your teammates are already querying Su-Mati — you're position{" "}
        <strong>#{position + 1}</strong>, est. <strong>~{estimatedWait}s</strong>
      </span>
      <div style={{ width: 80, height: 3, background: dark ? "#1e3a5f" : "#bfdbfe", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#3b82f6", borderRadius: 2, width: "30%", animation: "qprog 3s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes qprog{0%{width:15%}100%{width:70%}}`}</style>
    </div>
  );
}

function ThinkingBubble({ mode, dark }) {
  const [idx, setIdx] = useState(0);
  const msgs = mode === "general" ? GENERAL_THINK_MSGS : mode === "document" ? DOC_THINK_MSGS : THINK_MSGS;

  useEffect(() => {
    const iv = setInterval(() => setIdx(i => (i + 1) % msgs.length), 1800);
    return () => clearInterval(iv);
  }, [mode]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px",
      background: dark ? "#161b22" : "#ffffff",
      border: `0.5px solid ${dark ? "#30363d" : "#e5e7eb"}`,
      borderRadius: "4px 16px 16px 16px",
      fontSize: 13, color: dark ? "#8b949e" : "#6b7280",
      maxWidth: "80%",
    }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "#1d4ed8", opacity: 0.4,
            animation: `bounce 1s ease-in-out ${i*0.15}s infinite`,
          }} />
        ))}
      </div>
      <span>{msgs[idx]}</span>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

function Message({ msg, dark }) {
  const isUser = msg.role === "user";
  const meta = MODE_META[msg.mode] || MODE_META.internal;

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 4 }}>
      <div style={{ maxWidth: "85%" }}>
        {!isUser && msg.mode && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 600,
            color: meta.color, background: meta.bg,
            borderRadius: 4, padding: "2px 7px", marginBottom: 6,
          }}>
            {meta.label}
          </div>
        )}
        <div style={{
          padding: "11px 16px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser ? "#1d4ed8" : (dark ? "#161b22" : "#ffffff"),
          border: isUser ? "none" : `0.5px solid ${dark ? "#30363d" : "#e5e7eb"}`,
          color: isUser ? "#ffffff" : (dark ? "#e6edf3" : "#111827"),
          fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        {msg.toolsUsed?.length > 0 && (
          <div style={{ fontSize: 11, color: dark ? "#475569" : "#9ca3af", marginTop: 4, paddingLeft: 2 }}>
            Queried: {msg.toolsUsed.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatArea({ messages, loading, queueInfo, mode, dark, onSuggestion, isMobile }) {
  const chatRef = useRef(null);
  const bg = dark ? "#0d1117" : "#f0f2f5";
  const surface = dark ? "#161b22" : "#ffffff";
  const border = dark ? "#30363d" : "#e5e7eb";
  const muted = dark ? "#8b949e" : "#6b7280";
  const land = LANDING[mode] || LANDING.internal;

  // Filter messages to current mode only
  const filtered = messages.filter(m => !m.mode || m.mode === mode);

  // Scroll to bottom inside the chat container — not the whole page
  useEffect(() => {
    if (filtered.length > 0 && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div
      ref={chatRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: isMobile ? "12px 12px" : "20px",
        background: bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {filtered.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: "-0.5px", color: dark ? "#e6edf3" : "#111827" }}>
            Su-Mati
          </div>
          <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 700, letterSpacing: "-0.5px", color: dark ? "#e6edf3" : "#111827", textAlign: "center", lineHeight: 1.3 }}
            dangerouslySetInnerHTML={{ __html: land.title }} />
          <div style={{ fontSize: isMobile ? 13 : 14, color: muted, textAlign: "center", maxWidth: 420, lineHeight: 1.6, padding: "0 8px" }}>
            {land.sub}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: isMobile ? "100%" : 520, padding: "0 8px" }}>
            {(SUGGESTIONS[mode] || []).map((s) => (
              <button key={s} onClick={() => onSuggestion(s)} style={{
                padding: isMobile ? "10px 14px" : "8px 16px",
                borderRadius: 100,
                border: `1px solid ${border}`, background: surface,
                fontSize: isMobile ? 13 : 13,
                color: dark ? "#c9d1d9" : "#374151",
                cursor: "pointer", fontWeight: 500,
                textAlign: "center",
              }}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((msg, i) => <Message key={i} msg={msg} dark={dark} />)}
          {loading && queueInfo?.position > 0 && (
            <QueueBanner position={queueInfo.position} estimatedWait={queueInfo.estimatedWait} dark={dark} />
          )}
          {loading && <ThinkingBubble mode={mode} dark={dark} />}
        </div>
      )}
    </div>
  );
}
/**
 * InputBar.jsx — input with file upload for document mode.
 */
import { useState, useRef } from "react";

const ACCEPTED_TYPES = ".pdf,.csv,.txt,.md,.json,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.webp";

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    if (file.type.startsWith("image/")) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

export default function InputBar({ mode, onSend, loading, dark, onDocumentLoad }) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const bg = dark ? "#1e293b" : "#ffffff";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const inputBg = dark ? "#0f172a" : "#f8fafc";
  const muted = dark ? "#94a3b8" : "#64748b";

  const MODE_SEND_COLOR = {
    internal: "#1d4ed8",
    general: "#16a34a",
    document: "#d97706",
  };

  const placeholder = {
    internal: "Ask about ONDL orders and deliveries...",
    general: "Ask me anything — write, explain, brainstorm...",
    document: file ? `Ask about "${file.name}"...` : "Upload a file first, then ask questions...",
  }[mode];

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    if (mode === "document" && !file) return;
    onSend(text);
    setInput("");
  };

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    try {
      const content = await readFileAsText(f);
      onDocumentLoad(content, f.name);
    } catch {
      onDocumentLoad("(Could not read file content)", f.name);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const canSend = input.trim() && !loading && (mode !== "document" || file);
  const sendColor = canSend ? MODE_SEND_COLOR[mode] : (dark ? "#334155" : "#e2e8f0");
  const sendTextColor = canSend ? "#ffffff" : muted;

  return (
    <div style={{ padding: "10px 16px 14px", borderTop: `0.5px solid ${border}`, background: bg, flexShrink: 0 }}>
      {/* Document upload zone */}
      {mode === "document" && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `0.5px dashed ${dragging ? (dark ? "#60a5fa" : "#1d4ed8") : border}`,
            borderRadius: 8, padding: "8px 12px",
            marginBottom: 8, cursor: "pointer",
            background: dragging ? (dark ? "#0c1626" : "#eff6ff") : "transparent",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: file ? (dark ? "#4ade80" : "#16a34a") : muted,
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V3M8 3L5 6M8 3l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {file ? (
            <span>
              <strong>{file.name}</strong> loaded ·{" "}
              <span style={{ textDecoration: "underline" }} onClick={(e) => { e.stopPropagation(); setFile(null); onDocumentLoad(null, null); }}>
                remove
              </span>
            </span>
          ) : (
            "Drop a file or click to upload · PDF, CSV, Excel, Word, images, text"
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])} />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={placeholder}
          disabled={loading || (mode === "document" && !file)}
          style={{
            flex: 1, padding: "10px 14px",
            borderRadius: 9, border: `0.5px solid ${border}`,
            background: inputBg, color: text,
            fontSize: 13, outline: "none",
            opacity: (mode === "document" && !file) ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: "10px 18px", borderRadius: 9,
            border: "none", background: sendColor,
            color: sendTextColor, fontSize: 13,
            fontWeight: 500, cursor: canSend ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

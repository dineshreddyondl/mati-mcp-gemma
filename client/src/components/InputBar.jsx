/**
 * InputBar.jsx — Su-Mati input bar.
 * Clean pill design, file upload for document mode.
 */
import { useState, useRef } from "react";

const ACCEPTED = ".pdf,.csv,.txt,.md,.json,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.webp";

const PLACEHOLDERS = {
  internal: "Ask Su-Mati about ONDL orders and deliveries...",
  general: "Ask Su-Mati anything — write, explain, brainstorm...",
  document: "Upload a document first, then ask Su-Mati about it...",
};

const SEND_COLORS = {
  internal: "#1d4ed8",
  general: "#16a34a",
  document: "#d97706",
};

export default function InputBar({ mode, onSend, loading, dark, onDocumentLoad }) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const border = dark ? "#30363d" : "#e5e7eb";
  const bg = dark ? "#161b22" : "#ffffff";
  const inputBg = dark ? "#0d1117" : "#f9fafb";
  const text = dark ? "#e6edf3" : "#111827";
  const muted = dark ? "#8b949e" : "#9ca3af";
  const sendColor = SEND_COLORS[mode];
  const canSend = input.trim() && !loading && (mode !== "document" || file);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => onDocumentLoad(e.target.result, f.name);
    reader.onerror = () => onDocumentLoad("(Could not read file)", f.name);
    if (f.type.startsWith("image/")) reader.readAsDataURL(f);
    else reader.readAsText(f);
  };

  const handleSend = () => {
    const t = input.trim();
    if (!t || loading || (mode === "document" && !file)) return;
    onSend(t);
    setInput("");
  };

  return (
    <div style={{ padding: "10px 16px 16px", borderTop: `0.5px solid ${border}`, background: bg, flexShrink: 0 }}>
      {/* Document upload zone */}
      {mode === "document" && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `0.5px dashed ${dragging ? "#d97706" : border}`,
            borderRadius: 10, padding: "8px 14px", marginBottom: 8,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: file ? "#16a34a" : muted,
            background: dragging ? (dark ? "#1c1400" : "#fffbeb") : "transparent",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V3M8 3L5 6M8 3l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {file ? (
            <span>
              <strong>{file.name}</strong> ready ·{" "}
              <span style={{ textDecoration: "underline" }} onClick={(e) => { e.stopPropagation(); setFile(null); onDocumentLoad(null, null); }}>
                remove
              </span>
            </span>
          ) : "Drop a file or click to upload · PDF, CSV, Excel, Word, images"}
        </div>
      )}

      <input ref={fileRef} type="file" accept={ACCEPTED} style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])} />

      {/* Input row */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        background: inputBg, border: `1px solid ${border}`,
        borderRadius: 14, padding: "6px 6px 6px 16px",
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={PLACEHOLDERS[mode]}
          disabled={loading || (mode === "document" && !file)}
          style={{
            flex: 1, border: "none", background: "transparent",
            fontSize: 14, color: text, outline: "none", padding: "4px 0",
            opacity: (mode === "document" && !file) ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: "none",
            background: canSend ? sendColor : (dark ? "#21262d" : "#f3f4f6"),
            color: canSend ? "#fff" : muted,
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M14 8H2M14 8L9 3M14 8L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

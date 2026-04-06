/**
 * Sidebar.jsx — Su-Mati conversation history.
 * Shows all chats with mode color pip + timestamp.
 * Delete on hover.
 */

const MODE_COLORS = {
  internal: "#1d4ed8",
  general: "#16a34a",
  document: "#d97706",
};

const MODE_LABELS = {
  internal: "Order reporting",
  general: "General",
  document: "Document",
};

export default function Sidebar({ grouped, activeId, onSelect, onNew, onDelete, dark }) {
  const bg = dark ? "#161b22" : "#ffffff";
  const border = dark ? "#30363d" : "#e5e7eb";
  const text = dark ? "#e6edf3" : "#111827";
  const muted = dark ? "#8b949e" : "#9ca3af";
  const hover = dark ? "#21262d" : "#f3f4f6";
  const activeBg = dark ? "#1e3a5f" : "#eff6ff";

  return (
    <div style={{
      width: 224, background: bg,
      borderRight: `0.5px solid ${border}`,
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ padding: 10, borderBottom: `0.5px solid ${border}` }}>
        <button onClick={onNew} style={{
          width: "100%", padding: "9px 12px",
          borderRadius: 10, border: `1px solid ${border}`,
          background: dark ? "#0d1117" : "#f9fafb",
          cursor: "pointer", fontSize: 13,
          color: dark ? "#60a5fa" : "#1d4ed8",
          fontWeight: 600, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {grouped.length === 0 && (
          <div style={{ padding: "24px 16px", fontSize: 13, color: muted, textAlign: "center" }}>
            No conversations yet
          </div>
        )}
        {grouped.map(([label, items]) => (
          <div key={label}>
            <div style={{
              padding: "10px 12px 4px", fontSize: 10, color: muted,
              fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
            }}>{label}</div>
            {items.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                style={{
                  padding: "8px 10px", cursor: "pointer",
                  borderRadius: 8, margin: "1px 6px",
                  background: conv.id === activeId ? activeBg : "transparent",
                  display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: 6,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (conv.id !== activeId) e.currentTarget.style.background = hover; }}
                onMouseLeave={(e) => { if (conv.id !== activeId) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: text, fontWeight: 500,
                    whiteSpace: "nowrap", overflow: "hidden",
                    textOverflow: "ellipsis", marginBottom: 3,
                  }}>{conv.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: MODE_COLORS[conv.mode] || "#9ca3af",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {MODE_LABELS[conv.mode] || conv.mode} · {formatAge(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: muted, padding: 2, borderRadius: 4,
                    opacity: 0, flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4l-1 9a1 1 0 01-1 1H5a1 1 0 01-1-1L3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAge(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
